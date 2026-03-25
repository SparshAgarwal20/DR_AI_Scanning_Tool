import torch
import torch.nn as nn
from torchvision import models, transforms
from PIL import Image

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

quality_model = models.efficientnet_b0(weights=None)
quality_model.classifier[1] = nn.Linear(
    quality_model.classifier[1].in_features, 3
)
quality_model.load_state_dict(
    torch.load("models/quality/quality_model_b0.pt", map_location=device)
)
quality_classes = ["Good", "NonRetina", "Poor"]
quality_model.to(device)
quality_model.eval()

quality_transform = transforms.Compose([
    transforms.Resize((224, 224)),
    transforms.ToTensor(),
])

def predict_quality(image: Image.Image):
    image_tensor = quality_transform(image).unsqueeze(0).to(device)
    with torch.no_grad():
        output = quality_model(image_tensor)
        probabilities = torch.nn.functional.softmax(output[0], dim=0)
    predicted_index = torch.argmax(probabilities).item()
    confidence = probabilities[predicted_index].item()
    return {
        "quality": quality_classes[predicted_index],
        "confidence": round(confidence, 4)
    }
