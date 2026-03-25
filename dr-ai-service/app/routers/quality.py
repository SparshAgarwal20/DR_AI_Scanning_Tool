from fastapi import APIRouter, File, UploadFile
from PIL import Image
import io
from app.services.quality_service import predict_quality

router = APIRouter()

@router.post("/predict-quality")
async def predict_quality_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    quality_result = predict_quality(image)
    return {"quality": quality_result}
