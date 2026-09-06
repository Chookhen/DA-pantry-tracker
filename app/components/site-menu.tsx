import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router";

const MENU_TRANSITION_MS = 700;
const MENU_EASING = "cubic-bezier(0.65, 0, 0.35, 1)";

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function setClipPath(element: HTMLElement, value: string) {
  element.style.clipPath = value;
  element.style.setProperty("-webkit-clip-path", value);
}

function getClipPaths(panel: HTMLElement, toggle: HTMLElement) {
  const panelRect = panel.getBoundingClientRect();
  const toggleRect = toggle.getBoundingClientRect();
  const originX = toggleRect.left + toggleRect.width / 2 - panelRect.left;
  const originY = toggleRect.top + toggleRect.height / 2 - panelRect.top;
  const radius = Math.max(
    Math.hypot(originX, originY),
    Math.hypot(panelRect.width - originX, originY),
    Math.hypot(originX, panelRect.height - originY),
    Math.hypot(panelRect.width - originX, panelRect.height - originY),
  );

  return {
    closed: `circle(0px at ${originX}px ${originY}px)`,
    open: `circle(${radius}px at ${originX}px ${originY}px)`,
    radius,
  };
}

function getCircleRadius(clipPath: string, fallback: number) {
  const match = /^circle\(([\d.]+)px\s+at\s/.exec(clipPath);
  return match ? Number(match[1]) : fallback;
}

export function SiteMenu({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMenuActive, setIsMenuActive] = useState(false);
  const animationRef = useRef<Animation | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const clearAnimationFrame = useCallback(() => {
    if (animationFrameRef.current !== null) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
  }, []);

  const animatePanel = useCallback((opening: boolean) => {
    const panel = panelRef.current;
    const toggle = toggleRef.current;

    if (!panel || !toggle) {
      return;
    }

    const { closed, open, radius } = getClipPaths(panel, toggle);
    const target = opening ? open : closed;
    const fallbackRadius = opening ? 0 : radius;
    const current = getComputedStyle(panel).clipPath;
    let from = current === "none" ? (opening ? closed : open) : current;

    // The stylesheet's closed value is only a non-JavaScript fallback. Replace
    // its corner-based origin with the button's measured center before the
    // first opening frame so every browser interpolates the same two shapes.
    if (opening && getCircleRadius(from, 0) === 0) {
      from = closed;
    }

    animationRef.current?.cancel();
    animationRef.current = null;
    setClipPath(panel, from);

    const canAnimateClipPath =
      typeof panel.animate === "function" &&
      typeof CSS !== "undefined" &&
      CSS.supports("clip-path", "circle(1px at 1px 1px)");

    if (prefersReducedMotion() || !canAnimateClipPath) {
      setClipPath(panel, target);
      if (!opening) {
        setIsMenuActive(false);
      }
      return;
    }

    const currentRadius = getCircleRadius(from, fallbackRadius);
    const remainingDistance = Math.abs(
      (opening ? radius : 0) - currentRadius,
    );
    const duration = Math.max(
      1,
      MENU_TRANSITION_MS * (remainingDistance / radius),
    );
    const animation = panel.animate(
      [{ clipPath: from }, { clipPath: target }],
      {
        duration,
        easing: MENU_EASING,
        fill: "both",
      },
    );

    animationRef.current = animation;
    animation.onfinish = () => {
      setClipPath(panel, target);
      animation.cancel();
      if (animationRef.current === animation) {
        animationRef.current = null;
      }
      if (!opening) {
        setIsMenuActive(false);
      }
    };
  }, []);

  const openMenu = useCallback(() => {
    clearAnimationFrame();
    setIsMenuActive(true);
    setIsOpen(true);
    animationFrameRef.current = requestAnimationFrame(() => {
      animationFrameRef.current = null;
      animatePanel(true);
    });
  }, [animatePanel, clearAnimationFrame]);

  const closeMenu = useCallback(() => {
    clearAnimationFrame();
    setIsOpen(false);
    toggleRef.current?.focus();
    animatePanel(false);
  }, [animatePanel, clearAnimationFrame]);

  const toggleMenu = useCallback(() => {
    if (isOpen) {
      closeMenu();
    } else {
      openMenu();
    }
  }, [closeMenu, isOpen, openMenu]);

  useEffect(() => {
    return () => {
      clearAnimationFrame();
      animationRef.current?.cancel();
    };
  }, [clearAnimationFrame]);

  useEffect(() => {
    if (!isMenuActive) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeMenu();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeMenu, isMenuActive]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const onResize = () => {
      const panel = panelRef.current;
      const toggle = toggleRef.current;

      if (!panel || !toggle) {
        return;
      }

      animationRef.current?.cancel();
      animationRef.current = null;
      setClipPath(panel, getClipPaths(panel, toggle).open);
    };

    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [isOpen]);

  return (
    <>
      <div
        aria-hidden={isMenuActive || undefined}
        className="site-menu__content"
        inert={isMenuActive || undefined}
      >
        {children}
      </div>

      <div
        aria-hidden={!isOpen}
        aria-label="Site navigation"
        aria-modal="true"
        className="site-menu__panel"
        data-active={isMenuActive}
        data-open={isOpen}
        id="site-navigation"
        ref={panelRef}
        role="dialog"
      >
        <nav aria-label="Primary navigation">
          <Link
            className="site-menu__link"
            onClick={closeMenu}
            tabIndex={isOpen ? 0 : -1}
            to="/"
          >
            home
          </Link>
        </nav>
      </div>

      <button
        aria-controls="site-navigation"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Close navigation" : "Open navigation"}
        className="site-menu__toggle"
        data-open={isOpen}
        onClick={toggleMenu}
        ref={toggleRef}
        type="button"
      >
        <span aria-hidden="true" className="site-menu__icon">
          <span />
          <span />
          <span />
        </span>
      </button>
    </>
  );
}
