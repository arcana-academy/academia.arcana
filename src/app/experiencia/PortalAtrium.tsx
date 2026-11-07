import { ArrowRight, BookOpen, Compass, Library, ScrollText, Sparkles } from "lucide-react";

import styles from "./PortalAtrium.module.css";

/**
 * Presentation-only entry to the synthetic public experience.
 * Internal anchors keep ArcanaExperience and its active focus timer mounted.
 */
export function PortalAtrium() {
  return (
    <section className={styles.atrium} id="portal-atrio" aria-labelledby="portal-atrium-heading">
      <div className={styles.masthead}>
        <p className={styles.institution}><span className={styles.mastheadMark} aria-hidden="true" /> Academia Arcana <span className={styles.divider} aria-hidden="true">/</span> O Grande Átrio</p>
        <p className={styles.edition}>Experiência pessoal · prévia demonstrativa</p>
      </div>

      <div className={styles.layout}>
        <div className={styles.story}>
          <p className={styles.eyebrow}><Sparkles size={16} aria-hidden="true" /> O Portal do Conhecimento</p>
          <h1 id="portal-atrium-heading">O conhecimento abre <em>infinitos mundos.</em></h1>
          <p className={styles.lead}>
            Bem-vinda à Academia Arcana: um lugar onde a curiosidade conduz a jornada e cada área do saber
            merece ser explorada com profundidade, imaginação e liberdade.
          </p>
          <p className={styles.disciplines}>Ciências <span aria-hidden="true">✦</span> Linguagens <span aria-hidden="true">✦</span> Artes <span aria-hidden="true">✦</span> História <span aria-hidden="true">✦</span> Tecnologia</p>

          <nav className={styles.pathways} aria-label="Acessos do Portal do Conhecimento">
            <a className={styles.primary} href="#primeiro-grimorio">
              <BookOpen size={19} aria-hidden="true" />
              <span>Entrar no Primeiro Grimório</span>
              <ArrowRight size={19} aria-hidden="true" />
            </a>
            <a className={styles.secondary} href="#demo-missions-title">
              <Compass size={18} aria-hidden="true" />
              <span>Explorar missões e foco</span>
            </a>
          </nav>

          <div className={styles.libraryPreview}>
            <span className={styles.libraryIcon} aria-hidden="true"><Library size={21} /></span>
            <div className={styles.libraryCopy}>
              <strong>Biblioteca de Grimórios</strong>
              <span>O próximo ambiente está em preparação. Nenhum catálogo pessoal é exibido nesta prévia.</span>
            </div>
            <span className={styles.comingSoon}>Em preparação</span>
          </div>
        </div>

        <div className={styles.scene} aria-hidden="true">
          <span className={styles.sceneHalo} />
          <span className={styles.archOuter} />
          <span className={styles.archInner} />
          <span className={styles.portalDoor} />
          <span className={styles.seal} />
          <span className={styles.portalLight} />
          <span className={styles.stepOne} />
          <span className={styles.stepTwo} />
          <span className={styles.stepThree} />
          <span className={styles.sceneCaption}>AD SCIENTIAM · PER IMAGINATIONEM</span>
        </div>
      </div>

      <p className={styles.disclosure}>
        <ScrollText size={18} aria-hidden="true" />
        <span>Demonstração sem conta e sem banco de dados. As alterações ficam apenas neste navegador e podem ser reiniciadas.</span>
      </p>
    </section>
  );
}
