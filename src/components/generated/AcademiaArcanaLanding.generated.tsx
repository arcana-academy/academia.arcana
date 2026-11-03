"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, BookOpen, Brain, CalendarDays, Check, ChevronDown, Sparkles, Star, Wand2, X } from "lucide-react";
import styles from "./AcademiaArcanaLanding.module.css";

const features = [
  { icon: BookOpen, title: "Grimórios vivos", text: "Organize conteúdos, anotações e capítulos em um espaço de estudo que parece seu." },
  { icon: CalendarDays, title: "Missões & cronograma", text: "Transforme objetivos em passos claros, sessões de foco e progresso visível." },
  { icon: Brain, title: "Aprendizagem adaptativa", text: "A experiência se ajusta ao seu ritmo, contexto e forma de aprender." },
];

type LandingProps = { personalMode?: boolean };

export const AcademiaArcanaLanding = ({ personalMode = false }: LandingProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <main className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <nav className={styles.nav} aria-label="Navegação principal">
        <Link href="/" className={styles.brand} aria-label="Academia Arcana"><span className={styles.brandMark}><Sparkles size={20} /></span><span className={styles.brandName}>Academia Arcana</span></Link>
        <div className={styles.desktopNav}><a href="#recursos" className={styles.navLink}>Recursos</a><a href="#como-funciona" className={styles.navLink}>Como funciona</a><Link href="/login" className={styles.navCta}>Entrar na Academia</Link></div>
        <button type="button" className={styles.menuButton} aria-label={menuOpen ? "Fechar menu" : "Abrir menu"} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <ChevronDown size={20} />}</button>
      </nav>
      {menuOpen && <div className={styles.mobileMenu}><a href="#recursos" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Recursos</a><a href="#como-funciona" className={styles.mobileLink} onClick={() => setMenuOpen(false)}>Como funciona</a><Link href="/login" className={styles.mobileCta}>Entrar na Academia</Link></div>}

      <section className={styles.hero}>
        <div>
          <p className={styles.eyebrow}><Wand2 size={16} /> Um novo jeito de estudar</p>
          <h1 id="home-title" className={styles.heroTitle}>Transforme seu estudo em <span>uma jornada.</span></h1>
          <p className={styles.lead}>A Academia Arcana une planejamento, foco, conhecimento e gamificação em uma experiência feita para você aprender com mais clareza — e continuar avançando.</p>
          <div className={styles.actions}><Link href={personalMode ? "/login" : "/cadastro"} className={styles.primary}>{personalMode ? "Entrar no Santuário" : "Descobrir a Academia"} <ArrowRight size={20} /></Link><a href="#recursos" className={styles.secondary}>Explorar recursos</a>{!personalMode && <Link href="/experiencia" className={styles.secondary}>Experimentar agora</Link>}</div>
          <div className={styles.trust} aria-label="Princípios do produto"><span><Check size={16} /> Acessível</span><span><Check size={16} /> Personalizável</span><span><Check size={16} /> Feito para aprender</span></div>
        </div>
        <div className={styles.previewWrap} aria-label="Prévia do Santuário"><div className={styles.glow} aria-hidden="true" /><div className={styles.preview}><div className={styles.previewInner}><div className={styles.previewHeader}><div><p className={styles.previewKicker}>Prévia ilustrativa do Santuário</p><h2 className={styles.previewTitle}>Boa noite, Arcanista.</h2></div><div className={styles.previewIcon}><Star size={20} /></div></div><div className={styles.mission}><div className={styles.missionMeta}><span>Missão de hoje</span><span>3 / 5</span></div><div className={styles.progress} aria-label="Progresso da missão: 60%"><div className={styles.progressBar} /></div><p className={styles.missionText}>Revisar Fundamentos de Neuroaprendizagem</p></div><div className={styles.stats}><div className={styles.stat}><p className={styles.statLabel}>Foco</p><p className={styles.statValue}>42 min</p></div><div className={styles.stat}><p className={styles.statLabel}>Sequência</p><p className={styles.statValue}>7 dias</p></div></div></div></div></div>
      </section>

      <section id="recursos" className={styles.section + " " + styles.sectionBand} aria-labelledby="recursos-title">
        <div className={styles.container}><p className={styles.sectionEyebrow}>Seu arsenal</p><h2 id="recursos-title" className={styles.sectionTitle}>Tudo o que você precisa para continuar aprendendo.</h2><div className={styles.featureGrid}>{features.map(({ icon: Icon, title, text }) => <article key={title} className={styles.feature}><div className={styles.featureIcon}><Icon size={20} /></div><h3 className={styles.featureTitle}>{title}</h3><p className={styles.featureText}>{text}</p></article>)}</div></div>
      </section>

      <section id="como-funciona" className={styles.section} aria-labelledby="como-funciona-title">
        <div className={styles.container + " " + styles.split}><div><p className={styles.sectionEyebrow}>Seu ritmo, seu caminho</p><h2 id="como-funciona-title" className={styles.sectionTitle}>Menos fricção. Mais intenção.</h2><p className={styles.splitText}>Comece pelo que importa, transforme grandes objetivos em pequenas missões e acompanhe sua evolução sem transformar produtividade em cobrança.</p></div><div className={styles.callout}><h3 className={styles.calloutTitle}>A jornada começa pelo seu próximo passo.</h3><p className={styles.calloutText}>{personalMode ? "Entre com sua conta autorizada para continuar seus estudos no Santuário." : "Crie sua conta para entrar no Santuário e continuar a construção da experiência real da Academia Arcana."}</p><div className={styles.calloutActions}><Link href={personalMode ? "/login" : "/cadastro"} className={styles.primary}>{personalMode ? "Entrar no Santuário" : "Criar minha conta"}</Link>{!personalMode && <Link href="/login" className={styles.secondary}>Já tenho uma conta</Link>}</div></div></div>
      </section>

      <footer className={styles.footer}><div className={styles.footerInner}><span>© 2026 Academia Arcana</span><span>Aprender também pode parecer magia.</span><Link href="/login" className={styles.footerLink}>Entrar</Link></div></footer>
    </main>
  );
};
