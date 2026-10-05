import OpenAI from "openai";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const redis = Redis.fromEnv();

const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, "1 d"),
  analytics: false,
  prefix: "cdx-ratelimit",
});

const MAX_QUESTION_LENGTH = 600;
const MAX_CONTEXT_LENGTH = 12000;

function getClientIp(req) {
  const forwardedFor = req.headers["x-forwarded-for"];

  if (typeof forwardedFor === "string") {
    return forwardedFor.split(",")[0].trim();
  }

  return req.socket?.remoteAddress || "unknown";
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({
      error: "Méthode non autorisée.",
    });
  }

  try {
    const { question, context = "" } = req.body || {};

    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({
        error: "Aucune question reçue.",
      });
    }

    const cleanQuestion = question.trim();

    if (cleanQuestion.length > MAX_QUESTION_LENGTH) {
      return res.status(400).json({
        error:
          "Ta question est un peu trop longue. Essaie de la résumer en quelques phrases.",
      });
    }

    if (typeof context !== "string") {
      return res.status(400).json({
        error: "Contexte invalide.",
      });
    }

    if (context.length > MAX_CONTEXT_LENGTH) {
      return res.status(400).json({
        error: "Contexte trop volumineux.",
      });
    }

    const hasContext = Boolean(context.trim());

    // Si CDX ne possède aucune réflexion sur le sujet,
    // aucun appel payant à OpenAI n'est effectué.
    if (!hasContext) {
      return res.status(200).json({
        answer:
          "Je n’ai pas encore suffisamment développé cette réflexion dans CDX pour pouvoir te donner mon point de vue sur ce sujet.",
      });
    }

    // Protection des appels payants à l'IA :
    // maximum 10 questions par visiteur sur une période de 24 heures.
    const clientIp = getClientIp(req);
    const rateLimitResult = await ratelimit.limit(clientIp);

    if (!rateLimitResult.success) {
      return res.status(200).json({
        answer:
          "Vous avez atteint la limite de 10 questions pour aujourd’hui. Revenez demain pour continuer la conversation avec CDX.",
        rateLimited: true,
      });
    }

    const response = await openai.responses.create({
      model: "gpt-5.6-luna",

      instructions: `
Tu es CDX, une intelligence conversationnelle construite autour
des réflexions personnelles de son auteur.

Règles importantes :

- Tu ne prétends jamais détenir la vérité absolue.
- Tu distingues clairement une opinion personnelle d'un fait.
- Tu réponds naturellement, comme dans une vraie conversation.
- Tu peux expliquer, argumenter et nuancer.
- Tu ne dois jamais inventer une position personnelle de l'auteur.
- Tu ne dois jamais ajouter une nouvelle opinion qui n'est pas soutenue
  par les réflexions fournies.
- Les réflexions fournies dans le contexte sont ta source principale
  pour représenter le point de vue de l'auteur.
- Tu peux reformuler et relier les réflexions fournies afin de produire
  une réponse naturelle.
- Si une conclusion n'est pas soutenue par les réflexions fournies,
  ne l'attribue pas à l'auteur.
- Lorsqu'une position de l'auteur est clairement établie, exprime-la
  directement et avec conviction. Ne l'affaiblis pas artificiellement
  pour paraître neutre.
- Une réponse ferme ne doit jamais conduire à inventer, exagérer ou
  présenter comme certain un fait qui n'est pas établi.
- Ne mentionne pas le fonctionnement technique du contexte,
  du moteur ou de la base de connaissances au visiteur.
      `,

      input: `
QUESTION DU VISITEUR :

${cleanQuestion}

RÉFLEXIONS CDX DISPONIBLES :

${context}
      `,
    });

    return res.status(200).json({
      answer: response.output_text,
    });
  } catch (error) {
    console.error("CDX API ERROR:", error);

    return res.status(500).json({
      error: "CDX n'a pas pu répondre pour le moment.",
    });
  }
}