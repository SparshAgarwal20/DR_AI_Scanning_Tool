import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { ProcessedFile } from '../../models/api.models';

@Component({
  selector: 'app-processed-files',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './processed-files.component.html',
  styleUrl: './processed-files.component.scss',
})
export class ProcessedFilesComponent implements OnInit {
  files: ProcessedFile[] = [];
  loading = true;
  error = '';

  constructor(private readonly apiService: ApiService) {}

  ngOnInit(): void {
    this.loadFiles();
  }

  private loadFiles(): void {
    this.apiService.getProcessedFiles().subscribe({
      next: (res) => {
        this.files = res.files;
        this.loading = false;
      },
      error: () => {
        this.error = 'Could not load processed files.';
        this.loading = false;
      },
    });
  }
}
