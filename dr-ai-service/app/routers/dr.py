from fastapi import APIRouter, File, UploadFile
from PIL import Image
import io
from app.services.dr_service import predict_dr

router = APIRouter()

@router.post("/predict-dr")
async def predict_dr_endpoint(file: UploadFile = File(...)):
    contents = await file.read()
    image = Image.open(io.BytesIO(contents)).convert("RGB")
    dr_result = predict_dr(image)
    return {"dr_result": dr_result}
