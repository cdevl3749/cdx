import { useEffect, useRef, useState } from "react";
import "./App.css";
import { buildCDXContext } from "./engine/cdxEngine.js";

function App() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef(null);

  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "cdx",
      text:
        "Bonjour. Posez-moi une question sur l'éducation, la société, " +
        "la technologie ou simplement sur ma façon de voir le monde.",
    },
  ]);

  const closeMenu = () => setMenuOpen(false);

// Au chargement normal du site, revenir tout en haut de la Home.
useEffect(() => {
  if (!window.location.hash) {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: "instant",
    });
  }
}, []);

// Scroll automatique dans la conversation,
// mais jamais au premier chargement de la page.
useEffect(() => {
  if (messages.length === 1 && !isLoading) {
    return;
  }

  messagesEndRef.current?.scrollIntoView({
    behavior: "smooth",
    block: "end",
  });
}, [messages, isLoading]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const cleanQuestion = question.trim();

    if (!cleanQuestion || isLoading) {
      return;
    }

    const userMessage = {
      id: Date.now(),
      type: "user",
      text: cleanQuestion,
    };

    setMessages((currentMessages) => [
      ...currentMessages,
      userMessage,
    ]);

    setQuestion("");
    setIsLoading(true);

    try {
      const knowledge = buildCDXContext(cleanQuestion, 3);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          question: cleanQuestion,
          context: knowledge.found ? knowledge.context : "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || "Erreur lors de la réponse de CDX."
        );
      }

      const cdxMessage = {
        id: Date.now() + 1,
        type: "cdx",
        text:
          data.answer ||
          "Je n'ai pas pu formuler de réponse pour le moment.",
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        cdxMessage,
      ]);
    } catch (error) {
      console.error("CDX CHAT ERROR:", error);

      const errorMessage = {
        id: Date.now() + 1,
        type: "cdx",
        text:
          "Je rencontre un problème technique pour le moment. " +
          "Réessaie dans quelques instants.",
      };

      setMessages((currentMessages) => [
        ...currentMessages,
        errorMessage,
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="site">
      <header className={`header ${menuOpen ? "menu-open" : ""}`}>
        <a href="#accueil" className="logo" onClick={closeMenu}>
          CD<span>X</span>
        </a>

        <button
          type="button"
          className="menu-toggle"
          aria-label={menuOpen ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={menuOpen}
          aria-controls="main-nav"
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        <nav id="main-nav" className={`nav ${menuOpen ? "open" : ""}`}>
          <a href="#accueil" onClick={closeMenu}>
            Accueil
          </a>

          <a href="#about" onClick={closeMenu}>
            Qui suis-je ?
          </a>

          <a href="#reflexions" onClick={closeMenu}>
            Réflexions
          </a>

          <a href="#chat" className="nav-chat" onClick={closeMenu}>
            Parler avec CDX
          </a>
        </nav>
      </header>

      <main>
        <section className="hero" id="accueil">
          <div className="hero-overlay"></div>

          <div className="hero-content">
            <p className="eyebrow">
              OBSERVER · COMPRENDRE · CONSTRUIRE
            </p>

            <h1>
              CD<span>X</span>
            </h1>

            <p className="hero-subtitle">
              53 ans. Une vie. Mille questions.
            </p>

            <p className="hero-text">
              Un regard personnel sur notre société, l'éducation,
              la technologie et le monde qui change.
            </p>

            <a href="#chat" className="hero-button">
              Parler avec CDX
              <span>→</span>
            </a>
          </div>
        </section>

        <section className="intro" id="about">
          <p className="section-label">CDX</p>

          <h2>Pas une vérité. Un point de vue.</h2>

          <p>
            CDX est un espace de réflexion personnel. J'y partage mes idées,
            mes interrogations et ma vision de sujets qui façonnent notre
            quotidien.
          </p>
        </section>

        <section className="topics" id="reflexions">
          <div className="section-heading">
            <p className="section-label">RÉFLEXIONS</p>

            <h2>Les sujets qui me font réfléchir.</h2>
          </div>

          <div className="topic-grid">
            <article>
              <span>01</span>

              <h3>Éducation</h3>

              <p>
                École, parents, adolescents, réseaux sociaux et responsabilité.
              </p>
            </article>

            <article>
              <span>02</span>

              <h3>Technologie & IA</h3>

              <p>
                Ce que la technologie transforme dans notre façon de vivre,
                travailler et penser.
              </p>
            </article>

            <article>
              <span>03</span>

              <h3>Société</h3>

              <p>
                Observer notre époque, ses contradictions et les changements
                qui nous entourent.
              </p>
            </article>
          </div>
        </section>

        <section className="chat-section" id="chat">
          <div className="chat-intro">
            <p className="section-label">
              CDX · CONVERSATION
            </p>

            <h2>
              Et si vous pouviez discuter avec mes idées ?
            </h2>

            <p>
              Posez une question. CDX vous répondra à partir de mes réflexions,
              de mes expériences et de ma manière de voir les choses.
            </p>
          </div>

          <div className="chat-box">
            <div className="chat-top">
              <div className="status-dot"></div>

              <div>
                <strong>CDX</strong>
                <small>
                  {isLoading ? "CDX réfléchit..." : "Conversation"}
                </small>
              </div>
            </div>

            <div className="messages">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={
                    message.type === "user"
                      ? "message user-message"
                      : "message cdx-message"
                  }
                >
                  {message.text}
                </div>
              ))}

              {isLoading && (
                <div className="message cdx-message">
                  CDX réfléchit...
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            <form
              className="chat-input"
              onSubmit={handleSubmit}
            >
              <input
                type="text"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={
                  isLoading
                    ? "CDX réfléchit..."
                    : "Posez votre question à CDX..."
                }
                aria-label="Votre question"
                autoComplete="off"
                disabled={isLoading}
              />

              <button
                type="submit"
                aria-label="Envoyer"
                disabled={isLoading}
              >
                →
              </button>
            </form>
          </div>
        </section>
      </main>

      <footer className="footer">
        <div className="footer-logo">
          CD<span>X</span>
        </div>

        <p>Observer. Comprendre. Construire.</p>

        <p className="copyright">
          © 2026 CDX · Réflexions personnelles.
        </p>
      </footer>
    </div>
  );
}

export default App;