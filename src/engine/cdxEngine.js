import { CDX_KNOWLEDGE } from "../data/cdxKnowledge.js";

/*
  CDX ENGINE — V2

  Objectif :
  - retrouver les réflexions réellement pertinentes ;
  - privilégier les expressions précises ;
  - éviter qu'un mot générique comme "adolescent" ou "éducation"
    fasse remonter trop de réflexions ;
  - conserver uniquement les résultats proches du meilleur score.
*/

const STOP_WORDS = new Set([
  "alors",
  "avec",
  "avoir",
  "chez",
  "comme",
  "comment",
  "dans",
  "des",
  "donc",
  "elle",
  "elles",
  "encore",
  "est",
  "etre",
  "faire",
  "fait",
  "ils",
  "les",
  "leur",
  "leurs",
  "mais",
  "mes",
  "mon",
  "notre",
  "nous",
  "par",
  "pas",
  "peut",
  "plus",
  "pour",
  "pourquoi",
  "que",
  "quel",
  "quelle",
  "quelles",
  "quels",
  "qui",
  "quoi",
  "sans",
  "ses",
  "son",
  "sont",
  "sur",
  "tes",
  "toi",
  "ton",
  "tous",
  "tout",
  "tres",
  "une",
  "vos",
  "votre",
  "vous",
]);

function normalizeText(text = "") {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text = "") {
  return normalizeText(text)
    .split(" ")
    .filter(
      (word) =>
        word.length >= 3 &&
        !STOP_WORDS.has(word)
    );
}

function buildEntryText(topic, entry) {
  return [
    topic.title,
    topic.description,
    entry.title,
    ...(entry.keywords || []),
    entry.position,
    entry.reasoning,
  ].join(" ");
}

function calculateScore(question, topic, entry) {
  const normalizedQuestion = normalizeText(question);
  const questionWords = tokenize(question);

  const normalizedTitle = normalizeText(entry.title);

  const normalizedKeywords = (entry.keywords || [])
    .map(normalizeText)
    .filter(Boolean);

  const normalizedContent = normalizeText(
    buildEntryText(topic, entry)
  );

  let score = 0;
  let strongMatches = 0;

  /*
    1. Une expression-clé complète présente dans la question
       est notre signal le plus important.

       Exemple :
       "réseaux sociaux" dans la question
       + keyword "réseaux sociaux"
       = très forte correspondance.
  */

  normalizedKeywords.forEach((keyword) => {
    if (normalizedQuestion.includes(keyword)) {
      const keywordWords = keyword.split(" ").length;

      if (keywordWords >= 2) {
        score += 20;
        strongMatches += 2;
      } else {
        score += 8;
        strongMatches += 1;
      }
    }
  });

  /*
    2. Correspondance avec le titre.
  */

  questionWords.forEach((word) => {
    if (normalizedTitle.includes(word)) {
      score += 6;
    }
  });

  /*
    3. Correspondance avec les keywords.

       Une correspondance exacte vaut davantage
       qu'une simple présence dans le texte.
  */

  questionWords.forEach((word) => {
    const exactKeywordMatch = normalizedKeywords.some(
      (keyword) => keyword === word
    );

    const partialKeywordMatch = normalizedKeywords.some(
      (keyword) =>
        keyword.includes(word) ||
        word.includes(keyword)
    );

    if (exactKeywordMatch) {
      score += 5;
    } else if (partialKeywordMatch) {
      score += 2;
    }
  });

  /*
    4. Le contenu général compte, mais beaucoup moins.

       Cela empêche un simple mot présent dans un long texte
       de devenir aussi important qu'un vrai keyword.
  */

  questionWords.forEach((word) => {
    if (normalizedContent.includes(word)) {
      score += 0.5;
    }
  });

  /*
    5. Bonus lorsqu'une entrée possède plusieurs
       correspondances fortes avec la question.
  */

  if (strongMatches >= 2) {
    score += 10;
  }

  return score;
}

export function searchCDXKnowledge(question, limit = 3) {
  if (!question || !question.trim()) {
    return [];
  }

  const results = [];

  Object.entries(CDX_KNOWLEDGE.topics).forEach(
    ([topicId, topic]) => {
      topic.entries.forEach((entry) => {
        const score = calculateScore(
          question,
          topic,
          entry
        );

        if (score > 0) {
          results.push({
            topicId,
            topic: topic.title,
            score,

            entry: {
              id: entry.id,
              title: entry.title,
              position: entry.position,
              reasoning: entry.reasoning,
              keywords: entry.keywords,
            },
          });
        }
      });
    }
  );

  const sortedResults = results.sort(
    (a, b) => b.score - a.score
  );

  if (sortedResults.length === 0) {
    return [];
  }

  const bestScore = sortedResults[0].score;

  /*
    Une réflexion secondaire n'est conservée que si son score
    atteint au moins 60 % du meilleur résultat.

    On impose également un score minimum pour éviter
    les rapprochements trop faibles.
  */

  const relevantResults = sortedResults.filter(
    (result, index) => {
      if (index === 0) {
        return result.score >= 8;
      }

      return (
        result.score >= 8 &&
        result.score >= bestScore * 0.6
      );
    }
  );

  return relevantResults.slice(0, limit);
}

export function buildCDXContext(question, limit = 3) {
  const results = searchCDXKnowledge(
    question,
    limit
  );

  if (results.length === 0) {
    return {
      found: false,
      question,
      context: "",
      sources: [],
    };
  }

  const context = results
    .map(
      (result, index) => `
RÉFLEXION ${index + 1}
Thème : ${result.topic}
Titre : ${result.entry.title}

Position :
${result.entry.position}

Raisonnement :
${result.entry.reasoning}
      `.trim()
    )
    .join("\n\n");

  return {
    found: true,
    question,
    context,

    sources: results.map((result) => ({
      topicId: result.topicId,
      topic: result.topic,
      id: result.entry.id,
      title: result.entry.title,
      score: result.score,
    })),
  };
}

export function getCDXIdentity() {
  return CDX_KNOWLEDGE.identity;
}

export function getCDXPrinciples() {
  return CDX_KNOWLEDGE.principles;
}

export function getAvailableTopics() {
  return Object.entries(
    CDX_KNOWLEDGE.topics
  ).map(([id, topic]) => ({
    id,
    title: topic.title,
    description: topic.description,
    entriesCount: topic.entries.length,
  }));
}