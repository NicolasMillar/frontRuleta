import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  PLATFORM_ID,
  ViewChild,
  inject,
  signal
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  templateUrl: './navbar.component.html',
  styleUrl: './navbar.component.css'
})
export class NavbarComponent implements AfterViewInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);

  @ViewChild('siteHeader') siteHeaderRef?: ElementRef<HTMLElement>;
  @ViewChild('headerInner') headerInnerRef?: ElementRef<HTMLElement>;
  @ViewChild('siteMenu') siteMenuRef?: ElementRef<HTMLUListElement>;

  public readonly isWide = signal<boolean>(false);
  private resizeObserver?: ResizeObserver;
  private lastCollapsedWidth = 0;

  constructor(public participantsService: ParticipantsService) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const header = this.siteHeaderRef?.nativeElement;
    const menu = this.siteMenuRef?.nativeElement;
    if (!header || !menu) return;

    this.syncLayout(true);

    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => {
        this.syncLayout(false);
      });
      this.resizeObserver.observe(header);
      this.resizeObserver.observe(menu);
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
  }

  /**
   * Cierra el menú popover al navegar en vista colapsada
   */
  public closeMenuIfCollapsed(): void {
    if (this.isWide()) return;
    const menu = this.siteMenuRef?.nativeElement;
    if (menu && typeof menu.hidePopover === 'function') {
      try {
        menu.hidePopover();
      } catch {
        // El popover ya estaba cerrado
      }
    }
  }

  /**
   * Mide si la fila completa del navbar cabe en línea sin desbordar
   * y sincroniza la clase `is-wide` y el atributo `popover="auto"`.
   */
  private syncLayout(force: boolean): void {
    const header = this.siteHeaderRef?.nativeElement;
    const inner = this.headerInnerRef?.nativeElement;
    const menu = this.siteMenuRef?.nativeElement;
    if (!header || !inner || !menu) return;

    const headerWidth = header.clientWidth;
    if (!force && !this.isWide() && headerWidth <= this.lastCollapsedWidth) {
      return;
    }

    const wasOpen =
      !this.isWide() &&
      menu.hasAttribute('popover') &&
      menu.matches(':popover-open');

    header.classList.add('is-measuring');
    header.classList.add('is-wide');
    menu.removeAttribute('popover');

    const fitsInline = inner.scrollWidth <= inner.clientWidth + 1;

    if (fitsInline) {
      this.isWide.set(true);
      this.lastCollapsedWidth = 0;
    } else {
      this.isWide.set(false);
      this.lastCollapsedWidth = headerWidth;
      header.classList.remove('is-wide');
      menu.setAttribute('popover', 'auto');
      if (wasOpen && typeof menu.showPopover === 'function') {
        try {
          menu.showPopover();
        } catch {
          // Ignorar si no es posible reabrir
        }
      }
    }

    requestAnimationFrame(() => {
      header.classList.remove('is-measuring');
    });
  }
}
