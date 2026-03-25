

import os
import uuid
from fastapi import APIRouter, File, UploadFile
from PIL import Image
import io
from app.services.quality_service import predict_quality
from app.services.dr_service import predict_dr
# --- Add imports for DB and datetime ---
import pyodbc  # For SQL Server connection
from datetime import datetime
from fastapi import Request

router = APIRouter()


@router.get("/processed-files")
def list_processed_files(request: Request):
    processed_dir = os.path.join("UploadedImages", "ProcessedImages")
    os.makedirs(processed_dir, exist_ok=True)

    files = []
    for name in sorted(os.listdir(processed_dir), reverse=True):
        file_path = os.path.join(processed_dir, name)
        if os.path.isfile(file_path):
            files.append(
                {
                    "file_name": name,
                    "file_path": file_path,
                    "url": str(request.base_url).rstrip("/") + f"/UploadedImages/ProcessedImages/{name}",
                }
            )

    return {"files": files}

@router.post("/predict")
async def predict(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    quality_result = predict_quality(image)
    if quality_result["quality"] != "Good":
        rejection_message = "Image rejected: Poor quality." if quality_result["quality"] == "Poor" else "Image rejected: Non-retina."

        # --- Save rejected image to UploadedImages/UnprocessedImages folder ---
        unprocessed_dir = os.path.join("UploadedImages", "UnprocessedImages")
        os.makedirs(unprocessed_dir, exist_ok=True)
        # Always use the original uploaded file name
        file_name = file.filename
        file_path = os.path.join(unprocessed_dir, file_name)
        image.save(file_path)

        # --- Insert info into UnprocessedImages table with error handling ---
        try:
            conn = pyodbc.connect(
                "DRIVER={ODBC Driver 17 for SQL Server};"
                "SERVER=SEZLAP-14519\\NEXTECH;"
                "DATABASE=DRData;"
                "Trusted_Connection=yes;"
            )
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO dbo.UnprocessedImages
                (FileName, FilePath, Quality, Reason, CreatedAt)
                VALUES (?, ?, ?, ?, ?)
            """, (
                file_name,
                file_path,
                quality_result["quality"],
                rejection_message,
                datetime.now()
            ))
            conn.commit()
            cursor.close()
            conn.close()
            print(f"Inserted into UnprocessedImages: {file_name}, {file_path}, {quality_result['quality']}, {rejection_message}")
        except Exception as e:
            print("DB Insert Error (UnprocessedImages):", e)
            import logging
            logging.exception("Failed to insert into UnprocessedImages")

        return {
            "quality": quality_result,
            "message": rejection_message
        }

    # --- Use actual uploaded file name ---
    # --- Save processed image to UploadedImages/ProcessedImages folder ---
    processed_dir = os.path.join("UploadedImages", "ProcessedImages")
    os.makedirs(processed_dir, exist_ok=True)
    processed_file_name = file.filename
    processed_file_path = os.path.join(processed_dir, processed_file_name)
    image.save(processed_file_path)

    dr_result = predict_dr(image)
    dr_result["file_name"] = processed_file_name  # Overwrite with actual file name
    dr_result["file_path"] = processed_file_path

    # --- Insert prediction info into the database, including FilePath ---
    conn = pyodbc.connect(
        "DRIVER={ODBC Driver 17 for SQL Server};"
        "SERVER=SEZLAP-14519\\NEXTECH;"
        "DATABASE=DRData;"
        "Trusted_Connection=yes;"
    )
    cursor = conn.cursor()
    cursor.execute("""
        INSERT INTO dbo.DR_Predictions
        (FileName, FilePath, Severity, Confidence, CreatedAt, EtDrsScore, EtDrsLabel, EtDrsDescription)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        dr_result["file_name"],
        dr_result["file_path"],
        dr_result["dr_class"],
        dr_result["confidence"],
        datetime.now(),
        dr_result["etdrs_score"],
        dr_result["etdrs_label"],
        dr_result["etdrs_description"]
    ))
    conn.commit()
    cursor.close()
    conn.close()

    return {
        "quality": quality_result,
        "dr_result": dr_result
    }
