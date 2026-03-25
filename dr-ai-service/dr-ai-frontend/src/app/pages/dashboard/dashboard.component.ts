import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { ProcessedFile } from '../../models/api.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss',
})
export class DashboardComponent implements OnInit {
  apiStatus = 'Checking...';
  totalProcessed = 0;
  recentFiles: ProcessedFile[] = [];
  loading = true;

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.loadSummary();
  }

  private loadSummary(): void {
    this.apiService.getHealth().subscribe({
      next: (res) => {
        this.apiStatus = res.status;
      },
      error: () => {
        this.apiStatus = 'API unreachable';
      },
    });

    this.apiService.getProcessedFiles().subscribe({
      next: (res) => {
        this.totalProcessed = res.files.length;
        this.recentFiles = res.files.slice(0, 5);
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      },
    });
  }
}
