import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { PredictResponse } from '../../models/api.models';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize, timeout } from 'rxjs/operators';
import { ChangeDetectorRef } from '@angular/core';

@Component({
  selector: 'app-prediction',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './prediction.component.html',
  styleUrl: './prediction.component.scss',
})
export class PredictionComponent {
  selectedFile: File | null = null;
  previewUrl: string | null = null;
  predicting = false;
  private predictionRunId = 0;
  private predictionWatchdog: ReturnType<typeof setTimeout> | null = null;
  result: PredictResponse | null = null;
  errorMessage = '';
  predictionAttempted = false;
  lastApiPayload = '';
  rawResultText = '';
  reportGeneratedAt = new Date();
  readonly patient = {
    mrn: '2',
    name: 'Demo',
    doctor: 'Dr. Swast Eye Admin',
  };

  constructor(
    private readonly apiService: ApiService,
    private readonly cdr: ChangeDetectorRef
  ) {}

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0] ?? null;

    this.result = null;
    this.errorMessage = '';

    if (!file) {
      this.selectedFile = null;
      this.previewUrl = null;
      return;
    }

    this.selectedFile = file;
    this.previewUrl = URL.createObjectURL(file);
  }

  onPredict(): void {
    if (!this.selectedFile) {
      this.errorMessage = 'Please upload an image first.';
      return;
    }

    this.predictionRunId += 1;
    const currentRunId = this.predictionRunId;

    this.predictionAttempted = true;
    this.predicting = true;
    this.errorMessage = '';
    this.result = null;
    this.lastApiPayload = '';
    this.rawResultText = '';
    this.clearPredictionWatchdog();
    this.predictionWatchdog = setTimeout(() => {
      if (this.predicting && this.predictionRunId === currentRunId) {
        this.predicting = false;
        this.cdr.detectChanges();
      }
    }, 180000);

    this.apiService
      .predict(this.selectedFile)
      .pipe(
        timeout({ first: 120000 }),
        finalize(() => {
          this.stopPredicting(currentRunId);
        })
      )
      .subscribe({
        next: (res) => {
          this.stopPredicting(currentRunId);
          this.result = res;
          this.reportGeneratedAt = new Date();
          this.rawResultText = JSON.stringify(res?.raw ?? res, null, 2);
          this.lastApiPayload = JSON.stringify({
            quality: res?.quality?.quality,
            quality_confidence: res?.quality?.confidence,
            message: res?.message,
            has_dr_result: !!res?.dr_result,
            dr_class: res?.dr_result?.dr_class,
            dr_confidence: res?.dr_result?.confidence,
            has_gradcam: !!res?.dr_result?.gradcam,
          });
          this.cdr.detectChanges();
        },
        error: (error: unknown) => {
          this.stopPredicting(currentRunId);
          const httpError = error as HttpErrorResponse;
          const apiMessage =
            httpError?.error?.message ||
            httpError?.error?.detail ||
            (httpError as any)?.message ||
            'Prediction failed or timed out.';
          this.errorMessage = apiMessage;
          const rawError =
            typeof httpError?.error === 'string'
              ? httpError.error
              : JSON.stringify(httpError?.error || {});
          this.lastApiPayload = rawError.length > 1500 ? `${rawError.slice(0, 1500)}...` : rawError;
          this.rawResultText = this.lastApiPayload;
          this.cdr.detectChanges();
        },
      });
  }

  getEyeFindingText(): string {
    const drClass = this.getDrClassText();
    if (!drClass) {
      return 'Not available';
    }

    if (drClass === 'No DR') {
      return 'No apparent DR [0]';
    }

    return `${drClass} [${this.result?.dr_result?.etdrs_score ?? '-'}]`;
  }

  getScreeningSummary(): string {
    const drClass = this.getDrClassText();
    if (!drClass || drClass === 'No DR') {
      return 'Negative for referable diabetic retinopathy';
    }
    return 'Referable diabetic retinopathy suspected';
  }

  getDiagnosisCode(): string {
    const drClass = this.getDrClassText();
    if (!drClass || drClass === 'No DR') {
      return 'E10.9 : Type 1 diabetes mellitus without complications';
    }
    return 'E11.319 : Type 2 diabetes mellitus with unspecified diabetic retinopathy';
  }

  printReport(): void {
    window.print();
  }

  hasDrResult(): boolean {
    return !!this.result?.dr_result?.dr_class;
  }

  getQualityText(): string {
    const value = this.result?.quality?.quality;
    return typeof value === 'string' && value.trim() ? value : 'Unknown';
  }

  getQualityConfidence(): number {
    const value = Number(this.result?.quality?.confidence ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  getDrClassText(): string {
    const value = this.result?.dr_result?.dr_class;
    return typeof value === 'string' && value.trim() ? value : '';
  }

  getDrConfidence(): number {
    const value = Number(this.result?.dr_result?.confidence ?? 0);
    return Number.isFinite(value) ? value : 0;
  }

  getQualityAlertMessage(): string {
    const quality = this.normalizeQualityText(this.getQualityText());
    if (!quality) {
      return '';
    }

    if (quality.includes('non') && quality.includes('retina')) {
      return 'This is a non-retina image. Please upload a valid fundus retina image.';
    }

    if (quality.includes('poor')) {
      return 'This is a poor-quality image. Please upload a clearer retina image.';
    }

    if (quality.includes('good')) {
      return 'Image quality is good. DR prediction completed successfully.';
    }

    return this.result?.message || `Image quality status: ${this.getQualityText()}`;
  }

  isQualityRejected(): boolean {
    const quality = this.normalizeQualityText(this.getQualityText());
    return (quality.includes('non') && quality.includes('retina')) || quality.includes('poor');
  }

  getGradcamImageSrc(): string | null {
    const gradcam = this.result?.dr_result?.gradcam;
    if (!gradcam) {
      return null;
    }
    return `data:image/png;base64,${gradcam}`;
  }

  private normalizeQualityText(value: string | undefined): string {
    return (value || '').toLowerCase().replace(/[^a-z]/g, '');
  }

  private stopPredicting(runId: number): void {
    if (runId !== this.predictionRunId) {
      return;
    }
    this.predicting = false;
    this.clearPredictionWatchdog();
    this.cdr.detectChanges();
  }

  private clearPredictionWatchdog(): void {
    if (!this.predictionWatchdog) {
      return;
    }
    clearTimeout(this.predictionWatchdog);
    this.predictionWatchdog = null;
  }

}
