import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonContent } from '@ionic/angular/standalone';

@Component({
  selector: 'app-dashboard-business',
  templateUrl: './business.page.html',
  styleUrls: ['./business.page.scss'],
  standalone: true,
  imports: [CommonModule, RouterModule, IonContent]
})
export class BusinessPage {}