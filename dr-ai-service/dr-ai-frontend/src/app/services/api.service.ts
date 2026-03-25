import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { DrResult, PredictResponse, ProcessedFilesResponse, QualityResult } from '../models/api.models';

@Injectable({
  providedIn: 'root',
})
export class ApiService {
  private readonly baseUrl = 'http://127.0.0.1:8000';

  constructor(private readonly http: HttpClient) {}

  private toNumber(value: unknown): number {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  }

  private normalizeQualityResponse(response: any): QualityResult {
    const rawQuality = response?.quality ?? response?.quality_result ?? response?.result?.quality;

    if (typeof rawQuality === 'string') {
      const confidence =
        response?.quality_confidence ??
        response?.qualityConfidence ??
        response?.confidence ??
        response?.result?.quality_confidence ??
        response?.result?.confidence;
      return { quality: rawQuality, confidence: this.toNumber(confidence) };
    }

    if (rawQuality && typeof rawQuality === 'object') {
      return {
        quality: String(rawQuality.quality ?? rawQuality.label ?? 'Unknown'),
        confidence: this.toNumber(rawQuality.confidence ?? rawQuality.score),
      };
    }

    return { quality: 'Unknown', confidence: 0 };
  }

  private normalizeDrResponse(response: any): DrResult | undefined {
    const rawDr = response?.dr_result ?? response?.drResult ?? response?.result?.dr_result;

    if (rawDr && typeof rawDr === 'object') {
      return {
        dr_class: String(rawDr.dr_class ?? rawDr.class ?? 'Unknown'),
        confidence: this.toNumber(rawDr.confidence ?? rawDr.score),
        gradcam: rawDr.gradcam,
        etdrs_score: rawDr.etdrs_score,
        etdrs_label: rawDr.etdrs_label,
        etdrs_description: rawDr.etdrs_description,
        file_name: rawDr.file_name,
        file_path: rawDr.file_path,
      };
    }

    if (response?.dr_class || response?.drClass) {
      return {
        dr_class: String(response?.dr_class ?? response?.drClass),
        confidence: this.toNumber(response?.dr_confidence ?? response?.confidence),
        gradcam: response?.gradcam,
        etdrs_score: response?.etdrs_score,
        etdrs_label: response?.etdrs_label,
        etdrs_description: response?.etdrs_description,
      };
    }

    return undefined;
  }

  private normalizePredictResponse(response: any): PredictResponse {
    const quality = this.normalizeQualityResponse(response);
    const drResult = this.normalizeDrResponse(response);
    const message = response?.message ?? response?.msg ?? '';

    return {
      quality,
      dr_result: drResult,
      message,
      raw: response,
    };
  }

  predict(file: File): Observable<PredictResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return this.http
      .post<any>(`${this.baseUrl}/predict`, formData)
      .pipe(map((response) => this.normalizePredictResponse(response)));
  }

  predictQuality(file: File): Observable<QualityResult> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<any>(`${this.baseUrl}/predict-quality`, formData)
      .pipe(map((response) => this.normalizeQualityResponse(response)));
  }

  predictDr(file: File): Observable<DrResult | undefined> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http
      .post<any>(`${this.baseUrl}/predict-dr`, formData)
      .pipe(map((response) => this.normalizeDrResponse(response)));
  }

  getProcessedFiles(): Observable<ProcessedFilesResponse> {
    return this.http.get<ProcessedFilesResponse>(`${this.baseUrl}/processed-files`);
  }

  getHealth(): Observable<{ status: string }> {
    return this.http.get<{ status: string }>(`${this.baseUrl}/`);
  }
}
