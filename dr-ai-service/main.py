from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.routers import dr, quality, predict

app = FastAPI(title="DR AI POC Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://127.0.0.1:4200",
    ],
    allow_origin_regex=r"^http://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/UploadedImages", StaticFiles(directory="UploadedImages"), name="UploadedImages")

app.include_router(dr.router)
app.include_router(quality.router)
app.include_router(predict.router)

@app.get("/")
def health_check():
    return {"status": "AI Service Running Successfully"}
