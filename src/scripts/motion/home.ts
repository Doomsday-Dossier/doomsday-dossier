import { gsap, ScrollTrigger } from './grammar';

/** Home choreography: the reveal, the roll call of chairs, and the signals rail. */
export function homeMotion(reduced: boolean) {
  if (reduced) return;

  // 02 The reveal: the line of cloaked figures resolves into one name.
  const rev = document.querySelector<HTMLElement>('[data-reveal-pin]');
  if (rev) {
    const figs = rev.querySelectorAll<HTMLElement>('.fig');
    const name = rev.querySelector<HTMLElement>('.rev-name');
    const copy = rev.querySelector<HTMLElement>('.rev-copy');
    const tl = gsap.timeline({ scrollTrigger: { trigger: rev, start: 'top top', end: '+=180%', pin: true, scrub: 0.8, anticipatePin: 1 } });
    tl.from(figs, { yPercent: 120, opacity: 0, stagger: 0.06, duration: 0.6, ease: 'power3.out' })
      .to(figs, { opacity: (i) => (i === Math.floor(figs.length / 2) ? 1 : 0.08), duration: 0.4 }, '+=0.2')
      .to(figs[Math.floor(figs.length / 2)], { scaleY: 1.35, backgroundColor: 'rgba(61,255,138,0.85)', boxShadow: '0 0 80px rgba(61,255,138,0.6)', duration: 0.5 }, '<')
      .from(name, { opacity: 0, letterSpacing: '0.6em', filter: 'blur(16px)', duration: 0.6 }, '-=0.2')
      .from(copy, { opacity: 0, y: 30, duration: 0.4 }, '-=0.2');
  }

  // 03 Roll call: chairs turn to face you one by one, like the livestream.
  const roll = document.querySelector<HTMLElement>('[data-roll]');
  if (roll) {
    const chairs = roll.querySelectorAll<HTMLElement>('.chair');
    const counter = roll.querySelector<HTMLElement>('.roll-count');
    const isWide = innerWidth >= 900;
    gsap.set(chairs, { rotateY: 180 });
    gsap.to(chairs, {
      rotateY: 0, ease: 'power2.inOut', stagger: 0.12,
      scrollTrigger: {
        trigger: roll, start: isWide ? 'top top' : 'top 70%', end: isWide ? '+=220%' : 'bottom 60%', scrub: 0.6, pin: isWide ? roll : false,
        onUpdate: (st) => { if (counter) counter.textContent = String(Math.round(st.progress * chairs.length)).padStart(2, '0'); },
      },
    });
  }

  // 04 The signals: a horizontal rail of dated, sourced moments.
  const sig = document.querySelector<HTMLElement>('[data-signals]');
  if (sig && innerWidth >= 900) {
    const rail = sig.querySelector<HTMLElement>('.sig-rail')!;
    const dist = () => rail.scrollWidth - innerWidth + 80;
    gsap.to(rail, { x: () => -dist(), ease: 'none', scrollTrigger: { trigger: sig, start: 'top top', end: () => `+=${dist()}`, pin: true, scrub: 0.6, invalidateOnRefresh: true } });
  } else if (sig) {
    sig.querySelectorAll('.sig').forEach((s) => gsap.from(s, { y: 40, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: s, start: 'top 88%', once: true } }));
  }

  // 05 Assemble: teams stagger in like a formation.
  document.querySelectorAll<HTMLElement>('.team-block').forEach((tb) => {
    gsap.from(tb.querySelectorAll('.card'), { y: 60, opacity: 0, rotateX: -25, stagger: 0.07, duration: 1, ease: 'power3.out', scrollTrigger: { trigger: tb, start: 'top 80%', once: true } });
  });

  ScrollTrigger.refresh();
}
