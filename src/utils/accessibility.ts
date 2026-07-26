/**
 * Accessibility utilities and helpers
 */

/**
 * Generate a unique ID for form elements
 */
export const generateId = (prefix: string = 'id'): string => {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Announce text to screen readers
 */
export const announceToScreenReader = (message: string, priority: 'polite' | 'assertive' = 'polite'): void => {
  const announcement = document.createElement('div');
  announcement.setAttribute('aria-live', priority);
  announcement.setAttribute('aria-atomic', 'true');
  announcement.className = 'sr-only';
  announcement.textContent = message;
  
  document.body.appendChild(announcement);
  
  // Remove after announcement
  setTimeout(() => {
    document.body.removeChild(announcement);
  }, 1000);
};

/**
 * Focus management utilities
 */
export const focusUtils = {
  /**
   * Get all focusable elements within a container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    const selector = [
      'button:not([disabled])',
      '[href]',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
      '[contenteditable="true"]',
    ].join(', ');
    
    return Array.from(container.querySelectorAll(selector));
  },

  /**
   * Focus the first focusable element in a container
   */
  focusFirst: (container: HTMLElement): boolean => {
    const focusable = focusUtils.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[0].focus();
      return true;
    }
    return false;
  },

  /**
   * Focus the last focusable element in a container
   */
  focusLast: (container: HTMLElement): boolean => {
    const focusable = focusUtils.getFocusableElements(container);
    if (focusable.length > 0) {
      focusable[focusable.length - 1].focus();
      return true;
    }
    return false;
  },

  /**
   * Save current focus and return a function to restore it
   */
  saveFocus: (): (() => void) => {
    const activeElement = document.activeElement as HTMLElement;
    return () => {
      if (activeElement && activeElement.focus) {
        activeElement.focus();
      }
    };
  },
};

/**
 * ARIA utilities
 */
export const ariaUtils = {
  /**
   * Set ARIA expanded state
   */
  setExpanded: (element: HTMLElement, expanded: boolean): void => {
    element.setAttribute('aria-expanded', expanded.toString());
  },

  /**
   * Set ARIA selected state
   */
  setSelected: (element: HTMLElement, selected: boolean): void => {
    element.setAttribute('aria-selected', selected.toString());
  },

  /**
   * Set ARIA pressed state for toggle buttons
   */
  setPressed: (element: HTMLElement, pressed: boolean): void => {
    element.setAttribute('aria-pressed', pressed.toString());
  },

  /**
   * Set ARIA hidden state
   */
  setHidden: (element: HTMLElement, hidden: boolean): void => {
    if (hidden) {
      element.setAttribute('aria-hidden', 'true');
    } else {
      element.removeAttribute('aria-hidden');
    }
  },

  /**
   * Set ARIA describedby relationship
   */
  setDescribedBy: (element: HTMLElement, describedById: string): void => {
    element.setAttribute('aria-describedby', describedById);
  },

  /**
   * Set ARIA labelledby relationship
   */
  setLabelledBy: (element: HTMLElement, labelledById: string): void => {
    element.setAttribute('aria-labelledby', labelledById);
  },
};

/**
 * Keyboard navigation helpers
 */
export const keyboardUtils = {
  /**
   * Check if key is an arrow key
   */
  isArrowKey: (key: string): boolean => {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(key);
  },

  /**
   * Check if key is a navigation key
   */
  isNavigationKey: (key: string): boolean => {
    return ['Home', 'End', 'PageUp', 'PageDown', ...keyboardUtils.getArrowKeys()].includes(key);
  },

  /**
   * Get arrow keys array
   */
  getArrowKeys: (): string[] => {
    return ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  },

  /**
   * Handle roving tabindex for a group of elements
   */
  handleRovingTabindex: (elements: HTMLElement[], currentIndex: number): void => {
    elements.forEach((element, index) => {
      if (index === currentIndex) {
        element.setAttribute('tabindex', '0');
        element.focus();
      } else {
        element.setAttribute('tabindex', '-1');
      }
    });
  },
};

/**
 * Color contrast utilities
 */
export const contrastUtils = {
  /**
   * Calculate relative luminance of a color
   */
  getLuminance: (r: number, g: number, b: number): number => {
    const [rs, gs, bs] = [r, g, b].map(c => {
      c = c / 255;
      return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
  },

  /**
   * Calculate contrast ratio between two colors
   */
  getContrastRatio: (color1: [number, number, number], color2: [number, number, number]): number => {
    const lum1 = contrastUtils.getLuminance(...color1);
    const lum2 = contrastUtils.getLuminance(...color2);
    const brightest = Math.max(lum1, lum2);
    const darkest = Math.min(lum1, lum2);
    return (brightest + 0.05) / (darkest + 0.05);
  },

  /**
   * Check if contrast ratio meets WCAG AA standards
   */
  meetsWCAGAA: (contrastRatio: number, isLargeText: boolean = false): boolean => {
    return contrastRatio >= (isLargeText ? 3 : 4.5);
  },

  /**
   * Check if contrast ratio meets WCAG AAA standards
   */
  meetsWCAGAAA: (contrastRatio: number, isLargeText: boolean = false): boolean => {
    return contrastRatio >= (isLargeText ? 4.5 : 7);
  },
};

/**
 * Screen reader utilities
 */
export const screenReaderUtils = {
  /**
   * Create screen reader only text
   */
  createSROnlyText: (text: string): HTMLSpanElement => {
    const span = document.createElement('span');
    span.className = 'sr-only';
    span.textContent = text;
    return span;
  },

  /**
   * Add screen reader only description to an element
   */
  addSRDescription: (element: HTMLElement, description: string): string => {
    const id = generateId('sr-desc');
    const descElement = screenReaderUtils.createSROnlyText(description);
    descElement.id = id;
    element.appendChild(descElement);
    ariaUtils.setDescribedBy(element, id);
    return id;
  },
};

/**
 * Form accessibility helpers
 */
export const formUtils = {
  /**
   * Associate label with form control
   */
  associateLabel: (label: HTMLLabelElement, control: HTMLElement): void => {
    const id = control.id || generateId('form-control');
    control.id = id;
    label.setAttribute('for', id);
  },

  /**
   * Add error message to form control
   */
  addErrorMessage: (control: HTMLElement, message: string): string => {
    const errorId = generateId('error');
    const errorElement = document.createElement('div');
    errorElement.id = errorId;
    errorElement.className = 'text-red-600 text-sm mt-1';
    errorElement.textContent = message;
    errorElement.setAttribute('role', 'alert');
    
    control.parentNode?.insertBefore(errorElement, control.nextSibling);
    ariaUtils.setDescribedBy(control, errorId);
    control.setAttribute('aria-invalid', 'true');
    
    return errorId;
  },

  /**
   * Remove error message from form control
   */
  removeErrorMessage: (control: HTMLElement, errorId: string): void => {
    const errorElement = document.getElementById(errorId);
    if (errorElement) {
      errorElement.remove();
    }
    control.removeAttribute('aria-describedby');
    control.removeAttribute('aria-invalid');
  },
};