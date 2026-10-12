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
import { MatButtonModule } from '@angular/material/button';
import { Segment } from '../data/models';
import { StoreService } from '../data/store.service';
import { CategoryActions } from '../shared/category-actions.service';
import { CategoryChipComponent } from '../shared/category-chip.component';
import {
  applyChipStyle,
  CategoryMatch,
  createChip,
  domToSegments,
  findMatches,
  isChip,
  segmentsToDom,
} from './editor-dom';

let nextEditorId = 0;

/**
 * Rich text editor for interactions: plain text mixed with category chips.
 * While typing, words that prefix-match a category name open a suggestion list.
 */
@Component({
  selector: 'app-interaction-editor',
  imports: [MatButtonModule, CategoryChipComponent],
  templateUrl: './interaction-editor.component.html',
  styleUrl: './interaction-editor.component.scss',
})
export class InteractionEditorComponent {
  readonly segments = input<Segment[]>([]);
  readonly placeholder = input('Describe an interaction…');
  readonly saveLabel = input('Save');
  readonly showCancel = input(false);
  readonly clearOnSave = input(false);
  readonly autofocus = input(false);
  readonly save = output<Segment[]>();
  readonly cancel = output<void>();

  private readonly store = inject(StoreService);
  private readonly categoryActions = inject(CategoryActions);
  private readonly injector = inject(Injector);
  private readonly vcr = inject(ViewContainerRef);
  private readonly editorRef = viewChild<ElementRef<HTMLDivElement>>('editor');
  private readonly dropdownTpl = viewChild.required<TemplateRef<unknown>>('dropdown');

  protected readonly listboxId = `interaction-ac-${nextEditorId++}`;
  protected readonly matches = signal<CategoryMatch[]>([]);
  protected readonly active = signal(0);
  protected readonly empty = signal(true);

  private overlayRef?: OverlayRef;
  private positionStrategy?: FlexibleConnectedPositionStrategy;
  /** Set by Escape; suggestions stay hidden until the current word ends. */
  private dismissed = false;

  constructor() {
    afterNextRender(() => {
      this.setContent(this.segments());
      if (this.autofocus()) this.focus(true);
    });

    // Keep chips in sync with category edits/deletions made while editing.
    effect(() => {
      const byId = this.store.categoryById();
      const root = this.editorRef()?.nativeElement;
      if (!root) return;
      root.querySelectorAll<HTMLElement>('[data-cat-id]').forEach((chip) => {
        const category = byId.get(chip.dataset['catId']!);
        if (category) applyChipStyle(chip, category);
        else chip.replaceWith(root.ownerDocument.createTextNode(chip.textContent ?? ''));
      });
    });

    inject(DestroyRef).onDestroy(() => this.overlayRef?.dispose());
  }

  private get root(): HTMLDivElement {
    return this.editorRef()!.nativeElement;
  }

  focus(atEnd = false): void {
    const root = this.root;
    root.focus();
    if (atEnd) {
      const sel = root.ownerDocument.getSelection();
      sel?.selectAllChildren(root);
      sel?.collapseToEnd();
    }
  }

  protected submit(): void {
    const segments = domToSegments(this.root);
    if (!segments.length) return;
    this.closeDropdown();
    this.save.emit(segments);
    if (this.clearOnSave()) {
      this.setContent([]);
      this.focus();
    }
  }

  private setContent(segments: Segment[]): void {
    segmentsToDom(this.root, segments, this.store.categoryById());
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
      else this.submit();
    } else if (e.key === 'Escape' && this.showCancel()) {
      e.preventDefault();
      this.cancel.emit();
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

  protected onBlur(): void {
    this.closeDropdown();
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
    this.openDropdown(ctx!.range);
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

  private openDropdown(caret: Range): void {
    const rect = caret.getClientRects()[0] ?? this.root.getBoundingClientRect();
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

  private closeDropdown(): void {
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
