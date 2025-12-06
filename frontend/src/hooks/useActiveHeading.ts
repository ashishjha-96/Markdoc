import { useState, useEffect } from "react";

export function useActiveHeading(
  headingIds: string[],
  enabled: boolean = true
): string | null {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || headingIds.length === 0) {
      setActiveId(null);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleHeadings: Array<{ id: string; top: number }> = [];

        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("data-id");
            if (id && headingIds.includes(id)) {
              visibleHeadings.push({
                id,
                top: entry.boundingClientRect.top,
              });
            }
          }
        });

        if (visibleHeadings.length > 0) {
          // Sort by top position and select topmost
          visibleHeadings.sort((a, b) => a.top - b.top);
          setActiveId(visibleHeadings[0].id);
        }
      },
      {
        root: null,
        rootMargin: "-20% 0px -70% 0px",
        threshold: [0, 0.25, 0.5, 0.75, 1.0],
      }
    );

    // Observe all heading elements
    headingIds.forEach((id) => {
      const element = document.querySelector(`[data-id="${id}"]`);
      if (element) {
        observer.observe(element);
      }
    });

    return () => {
      observer.disconnect();
    };
  }, [headingIds, enabled]);

  return activeId;
}
