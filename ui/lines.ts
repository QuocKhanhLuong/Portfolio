/**
 * Line splitting for masked heading reveals.
 *
 * Headings reveal a line at a time from behind their own baseline. That needs
 * to know where the lines actually break, which only the browser knows — so the
 * text is measured after layout and regrouped, rather than animated per
 * character. Characters are not units of reading and a heading that assembles
 * itself letter by letter is a gimmick, not a reveal.
 */

export interface SplitLines {
  /** One element per visual line; animate these. */
  lines: HTMLElement[];
  /** Puts the original markup back. */
  revert: () => void;
}

export function splitLines(element: HTMLElement, maskClass: string, innerClass: string): SplitLines | null {
  const text = element.textContent ?? '';
  if (!text.trim()) return null;

  const original = element.innerHTML;
  const revert = () => {
    element.innerHTML = original;
  };

  // Measure with each word as its own box, so `offsetTop` reports which line it
  // landed on.
  const probes: HTMLElement[] = [];
  element.textContent = '';
  text.split(/(\s+)/).forEach((token) => {
    if (!token) return;
    if (/^\s+$/.test(token)) {
      element.appendChild(document.createTextNode(token));
      return;
    }
    const probe = document.createElement('span');
    probe.style.display = 'inline-block';
    probe.textContent = token;
    element.appendChild(probe);
    probes.push(probe);
  });

  if (!probes.length) {
    revert();
    return null;
  }

  const grouped: string[][] = [];
  let currentTop: number | null = null;
  probes.forEach((probe) => {
    const top = probe.offsetTop;
    if (currentTop === null || Math.abs(top - currentTop) > 1) {
      grouped.push([]);
      currentTop = top;
    }
    grouped[grouped.length - 1].push(probe.textContent ?? '');
  });

  element.textContent = '';
  const lines = grouped.map((words) => {
    const mask = document.createElement('span');
    mask.className = maskClass;
    const inner = document.createElement('span');
    inner.className = innerClass;
    inner.textContent = words.join(' ');
    mask.appendChild(inner);
    element.appendChild(mask);
    return inner;
  });

  return { lines, revert };
}
