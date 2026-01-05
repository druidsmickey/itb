import { Component, signal } from '@angular/core';
import { MatTabsModule } from '@angular/material/tabs';
import { Dataentry } from './dataentry/dataentry';
import { Single } from './single/single';
import { Chart } from './chart/chart';
import { ListdataComponent } from './list/list';
import { Winners } from './winners/winners';
import { Reports } from './reports/reports';
import { Params } from './params/params';
import { Init } from './init/init';
import { Merge } from './merge/merge';
import { ChangePassword } from './change-password/change-password';

@Component({
  selector: 'app-root',
  imports: [MatTabsModule, Dataentry, Single, Chart, ListdataComponent, Winners, Reports, Params, Init, Merge, ChangePassword],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('itb');
}
