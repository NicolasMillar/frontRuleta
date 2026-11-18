import {
  Component,
  ElementRef,
  PLATFORM_ID,
  ViewChild,
  computed,
  inject,
  AfterViewInit
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ParticipantsService } from '../../services/participants.service';
import { Participant } from '../../models/roulette.model';
import { LoadingComponent } from '../loading/loading.component';

@Component({
  selector: 'app-ranking',
  standalone: true,
  imports: [CommonModule, RouterLink, LoadingComponent],
  templateUrl: './ranking.component.html',
  styleUrl: './ranking.component.css'
})
export class RankingComponent implements AfterViewInit {
  private platformId = inject(PLATFORM_ID);

  @ViewChild('resetDialog') resetDialogRef?: ElementRef<HTMLDialogElement>;

  // Lista ordenada por victorias descendente
  readonly rankedParticipants = computed(() => {
    const list = [...this.participantsService.participants()];
    return list.sort((a, b) => (b.wins || 0) - (a.wins || 0));
  });

  /**
   * El botón de reinicio solo está habilitado el 1 de enero (día 1 del mes 0),
   * independientemente del año.
   */
  public get isNewYearDay(): boolean {
    const today = new Date();
    return today.getMonth() === 0 && today.getDate() === 1;
  }

  constructor(public participantsService: ParticipantsService) {}

  ngAfterViewInit(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.setupPopoverHintFallback();
  }

  public getParticipantColor(_index: number, participant: Participant): string {
    return (
      participant.color ||
      this.participantsService.getColorForParticipantName(participant.name)
    );
  }

  public getWinPercentage(wins: number): number {
    const total = this.participantsService.totalWins();
    if (total === 0) return 0;
    return Math.round((wins / total) * 100);
  }

  /**
   * Abre el diálogo nativo modal (<dialog>) de confirmación de reinicio
   */
  public openResetDialog(): void {
    if (!this.isNewYearDay) return;
    const dialog = this.resetDialogRef?.nativeElement;
    if (!dialog || dialog.open) return;

    this.attachClosedByFallback(dialog);
    dialog.showModal();
  }

  /**
   * Maneja el cierre del <dialog> nativo leyendo returnValue y reseteándolo
   * para evitar fugas de estado en cierres posteriores (e.g. tecla Esc).
   */
  public onResetDialogClose(): void {
    const dialog = this.resetDialogRef?.nativeElement;
    if (!dialog) return;

    const action = dialog.returnValue;
    dialog.returnValue = '';

    if (action === 'confirm' && this.isNewYearDay) {
      this.participantsService.resetWins();
    }
  }

  /**
   * Cierre animado progresivo para navegadores sin soporte completo de
   * overlay + transición discreta de display (e.g. Firefox / Safari).
   */
  public requestAnimatedClose(returnValue = 'cancel'): void {
    const dialog = this.resetDialogRef?.nativeElement;
    if (!dialog || !dialog.open) return;

    if (this.supportsTopLayerExit()) {
      dialog.close(returnValue);
      return;
    }

    dialog.setAttribute('data-closing', '');
    const animations = dialog.getAnimations({ subtree: true });
    if (animations.length > 0) {
      Promise.race([
        Promise.allSettled(animations.map((a) => a.finished)),
        new Promise((resolve) => setTimeout(resolve, 400))
      ]).then(() => {
        if (!dialog.hasAttribute('data-closing')) return;
        dialog.removeAttribute('data-closing');
        dialog.close(returnValue);
      });
    } else {
      dialog.removeAttribute('data-closing');
      dialog.close(returnValue);
    }
  }

  public onDialogCancel(event: Event): void {
    if (!this.supportsTopLayerExit()) {
      event.preventDefault();
      this.requestAnimatedClose('');
    }
  }

  /**
   * Fallback para navegadores sin `closedby="any"` (light dismiss al pulsar
   * y soltar fuera del rectángulo del <dialog>).
   */
  private attachClosedByFallback(dialog: HTMLDialogElement): void {
    if ('closedBy' in HTMLDialogElement.prototype) return;
    if (dialog.dataset['closedbyBound'] === 'true') return;
    dialog.dataset['closedbyBound'] = 'true';

    const isOutside = (e: PointerEvent) => {
      const r = dialog.getBoundingClientRect();
      return (
        e.clientX < r.left ||
        e.clientX > r.right ||
        e.clientY < r.top ||
        e.clientY > r.bottom
      );
    };

    let pressedOutside = false;
    dialog.addEventListener('pointerdown', (e) => {
      pressedOutside = isOutside(e);
    });
    dialog.addEventListener('pointerup', (e) => {
      if (pressedOutside && isOutside(e)) {
        this.requestAnimatedClose('');
      }
    });
  }

  /**
   * Fallback recomendado para toggletips cuando el navegador soporta popover
   * pero no `popover="hint"`: cambia a `popover="auto"` en `beforetoggle`.
   */
  private setupPopoverHintFallback(): void {
    if (!Object.hasOwn(HTMLElement.prototype, 'popover')) return;
    const probe = document.createElement('div');
    probe.popover = 'hint';
    if (probe.popover !== 'hint') {
      document.addEventListener(
        'beforetoggle',
        (event: Event) => {
          const toggleEvent = event as ToggleEvent;
          const target = toggleEvent.target as HTMLElement | null;
          if (!target) return;
          const isToggletip =
            target.getAttribute('popover') === 'hint' &&
            document.querySelector(`[popovertarget="${CSS.escape(target.id)}"]`);
          if (toggleEvent.newState === 'open' && isToggletip) {
            target.popover = 'auto';
          }
        },
        true
      );
    }
  }

  private supportsTopLayerExit(): boolean {
    return (
      typeof window !== 'undefined' &&
      Boolean(window.CSS?.supports?.('overlay', 'auto')) &&
      Boolean(window.CSS?.supports?.('transition-behavior', 'allow-discrete'))
    );
  }
}