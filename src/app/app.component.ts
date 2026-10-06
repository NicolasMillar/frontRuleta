import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { RouletteComponent } from './components/roulette/roulette.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouletteComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css'
})
export class AppComponent {
  title = 'frontRuleta';
}