import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { PredictionComponent } from './pages/prediction/prediction.component';
import { ProcessedFilesComponent } from './pages/processed-files/processed-files.component';

export const routes: Routes = [
	{ path: '', redirectTo: 'dashboard', pathMatch: 'full' },
	{ path: 'dashboard', component: DashboardComponent },
	{ path: 'prediction', component: PredictionComponent },
	{ path: 'processed-files', component: ProcessedFilesComponent },
	{ path: '**', redirectTo: 'dashboard' },
];
