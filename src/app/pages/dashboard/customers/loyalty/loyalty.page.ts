import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonContent, IonHeader, IonTitle, IonToolbar } from '@ionic/angular/standalone';

@Component({
  selector: 'app-loyalty',
  templateUrl: './loyalty.page.html',
  styleUrls: ['./loyalty.page.scss'],
  standalone: true,
  imports: [IonContent, IonHeader, IonTitle, IonToolbar, CommonModule, FormsModule]
})
export class LoyaltyPage implements OnInit {

  constructor() { }

  ngOnInit() {
  }

}
