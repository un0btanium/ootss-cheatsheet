import {
  createCloseScrollStrategy,
  createFlexibleConnectedPositionStrategy,
  createOverlayRef,
  FlexibleConnectedPositionStrategy,
  OverlayRef,
} from '@angular/cdk/overlay';
import { TemplatePortal } from '@angular/cdk/portal';
import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  TemplateRef,
  viewChild,
  ViewContainerRef,
} from '@angular/core';
import { Segment } from '../data/models';
import { StoreService } from '../data/store.service';
import {
  applyChipStyle,
  CategoryMatch,
  createChip,
  domToSegments,
  findMatches,
  isChip,
} from '../interactions/editor-dom';
import { CategoryActions } from '../shared/category-actions.service';
import { CategoryChipComponent } from '../shared/category-chip.component';

let nextInputId = 0;

/**
 * The single Zen Mode input: plain text mixed with category chips, with category
 * autocomplete. Enter (with no suggestion open) emits the content; the parent decides
 * what to do with it and calls `clear()` on success.
 */
@Component({
  selector: 'app-zen-input',
  imports: [CategoryChipComponent],
  template: `
    <div
      #editor
      class="editor"
      contenteditable="true"
      role="combobox"
      aria-multiline="true"
      aria-autocomplete="list"
      [attr.aria-expanded]="matches().length > 0"
      [attr.aria-controls]="listboxId"
      [attr.aria-activedescendant]="matches().length ? listboxId + '-' + active() : null"
      [attr.aria-label]="placeholder()"
      [attr.data-placeholder]="placeholder()"
      [class.empty]="empty()"
      spellcheck="true"
      (input)="onInput()"
      (keydown)="onKeydown($event)"
      (paste)="onPaste($event)"
      (drop)="$event.preventDefault()"
      (click)="onClick($event)"
      (blur)="closeDropdown()"
    ></div>

    <ng-template #dropdown>
      <div class="ac-panel" role="listbox" [id]="listboxId">
        @for (m of matches(); track m.category.id; let i = $index) {
          <div
            class="ac-option"
            role="option"
            [id]="listboxId + '-' + i"
            [attr.aria-selected]="i === active()"
            (mousedown)="$event.preventDefault(); accept(m)"
            (mouseenter)="active.set(i)"
          >
            <app-category-chip [category]="m.category" [plain]="true" />
          </div>
        }
      </div>
    </ng-template>
  `,
  styles: `
    :host {
      display: block;
    }
    .editor {
      padding: 16px 20px;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-large);
      background: var(--mat-sys-surface-container-lowest);
      font: var(--mat-sys-title-medium);
      white-space: pre-wrap;
      overflow-wrap: anywhere;
      line-height: 1.8;
      outline: none;
      cursor: text;

      &:focus {
        border-color: var(--mat-sys-primary);
        box-shadow: inset 0 0 0 1px var(--mat-sys-primary);
      }

      &.empty::before {
        content: attr(data-placeholder);
        color: var(--mat-sys-on-surface-variant);
        pointer-events: none;
      }
    }
    .ac-panel {
      min-width: 200px;
      max-height: 260px;
      overflow-y: auto;
      padding: 4px 0;
      border-radius: var(--mat-sys-corner-extra-small);
      background: var(--mat-sys-surface-container);
      box-shadow: var(--mat-sys-level2);
    }
    .ac-option {
      padding: 6px 12px;
      cursor: pointer;

      &[aria-selected='true'] {
        background: var(--mat-sys-secondary-container);
      }
    }
  `,
})
export class ZenInputComponent {
  readonly placeholder = input('Category, new category, or interaction…');
  readonly autofocus = input(true);
  /** Categories left out of the suggestions shown when Enter is pressed on an empty input. */
  readonly excludeIds = input<string[]>([]);
  readonly entered = output<Segment[]>();

  private readonly store = inject(StoreService);
  private readonly categoryActions = inject(CategoryActions);
  private readonly injector = inject(Injector);
  private readonly vcr = inject(ViewContainerRef);
  private readonly editorRef = viewChild.required<ElementRef<HTMLDivElement>>('editor');
  private readonly dropdownTpl = viewChild.required<TemplateRef<unknown>>('dropdown');

  protected readonly listboxId = `zen-ac-${nextInputId++}`;
  protected readonly matches = signal<CategoryMatch[]>([]);
  protected readonly active = signal(0);
  protected readonly empty = signal(true);

  private overlayRef?: OverlayRef;
  private positionStrategy?: FlexibleConnectedPositionStrategy;
  /** Set by Escape; suggestions stay hidden until the current word ends. */
  private dismissed = false;

  constructor() {
    afterNextRender(() => {
      if (this.autofocus()) this.focus();
    });

    // Keep chips in sync with category edits/deletions made while typing.
    effect(() => {
      const byId = this.store.categoryById();
      const root = this.editorRef().nativeElement;
      root.querySelectorAll<HTMLElement>('[data-cat-id]').forEach((chip) => {
        const category = byId.get(chip.dataset['catId']!);
        if (category) applyChipStyle(chip, category);
        else chip.replaceWith(root.ownerDocument.createTextNode(chip.textContent ?? ''));
      });
    });

    inject(DestroyRef).onDestroy(() => this.overlayRef?.dispose());
  }

  private get root(): HTMLDivElement {
    return this.editorRef().nativeElement;
  }

  focus(): void {
    const root = this.root;
    root.focus();
    const sel = root.ownerDocument.getSelection();
    sel?.selectAllChildren(root);
    sel?.collapseToEnd();
  }

  clear(): void {
    this.closeDropdown();
    this.root.replaceChildren();
    this.updateEmpty();
  }

  private updateEmpty(): void {
    const root = this.root;
    this.empty.set(!root.textContent?.trim() && !root.querySelector('[data-cat-id]'));
  }

  // --- Event handlers ---

  protected onInput(): void {
    this.updateEmpty();
    this.updateSuggestions();
  }

  protected onKeydown(e: KeyboardEvent): void {
    if (e.isComposing) return;
    const matches = this.matches();
    if (matches.length) {
      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowUp': {
          e.preventDefault();
          const delta = e.key === 'ArrowDown' ? 1 : -1;
          this.active.set((this.active() + delta + matches.length) % matches.length);
          this.scrollActiveIntoView();
          return;
        }
        case 'Enter':
        case 'Tab':
          e.preventDefault();
          this.accept(matches[this.active()]);
          return;
        case 'Escape':
          e.preventDefault();
          e.stopPropagation();
          this.dismissed = true;
          this.closeDropdown();
          return;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'Home':
        case 'End':
          this.closeDropdown();
          break;
      }
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (e.shiftKey) this.insertLineBreak();
      else if (this.empty()) this.suggestAll();
      else this.entered.emit(domToSegments(this.root));
    }
  }

  protected onPaste(e: ClipboardEvent): void {
    e.preventDefault();
    const text = e.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  protected onClick(e: MouseEvent): void {
    this.closeDropdown();
    const chip = (e.target as HTMLElement).closest('[data-cat-id]');
    if (!isChip(chip)) return;
    const category = this.store.categoryById().get(chip.dataset['catId']!);
    if (category) this.categoryActions.edit(category);
  }

  // --- Suggestions ---

  private updateSuggestions(): void {
    const ctx = this.caretContext();
    if (!ctx || /\s$/.test(ctx.textBefore) || !ctx.textBefore) this.dismissed = false;
    const matches =
      ctx && !this.dismissed ? findMatches(ctx.textBefore, this.store.categories()) : [];
    if (!matches.length) {
      this.closeDropdown();
      return;
    }
    this.matches.set(matches);
    this.active.set(0);
    this.openDropdown(ctx!.range.getClientRects()[0] ?? this.root.getBoundingClientRect());
  }

  /** Lists every category not excluded, e.g. those not yet in the puzzle. */
  private suggestAll(): void {
    const excluded = new Set(this.excludeIds());
    const matches = this.store
      .categories()
      .filter((c) => !excluded.has(c.id))
      .map((category) => ({ category, length: 0 }));
    if (!matches.length) return;
    this.matches.set(matches);
    this.active.set(0);
    this.openDropdown(this.root.getBoundingClientRect());
  }

  /** Text directly before the caret, spanning adjacent text nodes. */
  private caretContext(): { node: Text; offset: number; textBefore: string; range: Range } | null {
    const root = this.root;
    const sel = root.ownerDocument.getSelection();
    if (!sel || !sel.rangeCount || !sel.isCollapsed) return null;
    const node = sel.anchorNode;
    if (!(node instanceof Text) || !root.contains(node)) return null;
    let textBefore = node.data.slice(0, sel.anchorOffset);
    for (let prev = node.previousSibling; prev instanceof Text; prev = prev.previousSibling) {
      textBefore = prev.data + textBefore;
    }
    return { node, offset: sel.anchorOffset, textBefore, range: sel.getRangeAt(0) };
  }

  protected accept(match: CategoryMatch): void {
    if (this.empty()) {
      // Picked from the full list on an empty input: there is no typed text to replace.
      const root = this.root;
      root.replaceChildren(createChip(root.ownerDocument, match.category), ' ');
      this.closeDropdown();
      this.updateEmpty();
      this.focus();
      return;
    }
    const ctx = this.caretContext();
    if (!ctx) return;
    const doc = ctx.node.ownerDocument;

    // Find the start of the matched text, possibly in a previous text node.
    let startNode: Text = ctx.node;
    let startOffset = ctx.offset - match.length;
    while (startOffset < 0 && startNode.previousSibling instanceof Text) {
      startNode = startNode.previousSibling;
      startOffset += startNode.data.length;
    }
    const range = doc.createRange();
    range.setStart(startNode, Math.max(0, startOffset));
    range.setEnd(ctx.node, ctx.offset);
    range.deleteContents();

    const chip = createChip(doc, match.category);
    range.insertNode(chip);

    // Put the caret after the chip, separated by a space.
    let after = chip.nextSibling;
    if (!(after instanceof Text && /^\s/.test(after.data))) {
      after = doc.createTextNode(' ');
      chip.after(after);
    }
    doc.getSelection()?.collapse(after, 1);

    this.closeDropdown();
    this.updateEmpty();
  }

  private insertLineBreak(): void {
    if (document.execCommand('insertLineBreak')) return;
    // Fallback for browsers without insertLineBreak support.
    const sel = document.getSelection();
    if (!sel?.rangeCount) return;
    const range = sel.getRangeAt(0);
    range.deleteContents();
    const br = document.createElement('br');
    range.insertNode(br);
    if (!br.nextSibling) br.after(document.createElement('br'));
    sel.collapse(br.parentNode, [...br.parentNode!.childNodes].indexOf(br) + 1);
  }

  private openDropdown(rect: DOMRect): void {
    const origin = { x: rect.left, y: rect.top, width: 1, height: rect.height };

    if (!this.overlayRef) {
      this.positionStrategy = createFlexibleConnectedPositionStrategy(this.injector, origin)
        .withFlexibleDimensions(false)
        .withPush(true)
        .withPositions([
          { originX: 'start', originY: 'bottom', overlayX: 'start', overlayY: 'top', offsetY: 4 },
          { originX: 'start', originY: 'top', overlayX: 'start', overlayY: 'bottom', offsetY: -4 },
        ]);
      this.overlayRef = createOverlayRef(this.injector, {
        positionStrategy: this.positionStrategy,
        scrollStrategy: createCloseScrollStrategy(this.injector),
      });
      this.overlayRef.detachments().subscribe(() => this.matches.set([]));
    }
    this.positionStrategy!.setOrigin(origin);
    if (!this.overlayRef.hasAttached()) {
      this.overlayRef.attach(new TemplatePortal(this.dropdownTpl(), this.vcr));
    }
    this.overlayRef.updatePosition();
  }

  protected closeDropdown(): void {
    this.matches.set([]);
    if (this.overlayRef?.hasAttached()) this.overlayRef.detach();
  }

  private scrollActiveIntoView(): void {
    queueMicrotask(() =>
      this.overlayRef?.overlayElement
        .querySelector('[aria-selected="true"]')
        ?.scrollIntoView({ block: 'nearest' }),
    );
  }
}
