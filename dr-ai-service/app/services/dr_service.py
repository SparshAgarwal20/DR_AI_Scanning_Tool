
# Import necessary libraries
import torch  # PyTorch for deep learning
from torchvision import models, transforms  # Pretrained models and image transforms
from PIL import Image  # Image processing
import numpy as np  # Numerical operations
import os  # For file path operations
import uuid  # For unique file names
import base64  # For encoding images
import io  # For in-memory byte streams
from pytorch_grad_cam import GradCAM  # GradCAM for visual explanations
from pytorch_grad_cam.utils.model_targets import ClassifierOutputTarget  # Target for GradCAM
from pytorch_grad_cam.utils.image import show_cam_on_image  # Overlay GradCAM on image


# Set device to GPU if available, else CPU
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")


# Load EfficientNet-B3 model architecture
model = models.efficientnet_b3(weights=None)
# Change the classifier to output 5 classes (for DR severity)
model.classifier[1] = torch.nn.Linear(model.classifier[1].in_features, 5)
# Load trained model weights
model.load_state_dict(torch.load("models/dr/dr_model_b3.pt", map_location=device))
model.eval()  # Set model to evaluation mode
model.to(device)  # Move model to the selected device


# DR severity class labels
classes = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]


# Image preprocessing pipeline
transform = transforms.Compose([
    transforms.Resize((300, 300)),  # Resize image to 300x300
    transforms.ToTensor(),  # Convert image to tensor
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],  # Normalize with ImageNet mean
        std=[0.229, 0.224, 0.225]    # Normalize with ImageNet std
    )
])



# Predict DR severity from an input image
def predict_dr(image: Image.Image):
    # ETDRS score, label, and description for each class
    # Detailed ETDRS mapping based on provided table
    etdrs_info = [
        {"score": 10, "label": "DR absent", "description_one_eye": "All diabetic retinopathy features absent", "description_both_eyes": "All diabetic retinopathy features absent"},
        {"score": 20, "label": "MA only", "description_one_eye": "Microaneurysm(s) only, other lesions absent, one eye", "description_both_eyes": "Microaneurysm(s) only, other lesions absent, both eyes"},
        {"score": 35, "label": "Mild NPDR", "description_one_eye": "MA plus retinal hemorrhage(s) and/or hard exudates and/or cotton wool spots, one eye", "description_both_eyes": "MA plus retinal hemorrhage(s) and/or hard exudates and/or cotton wool spots, both eyes"},
        {"score": 43, "label": "Moderate NPDR", "description_one_eye": "Lesions as above + either extensive or severe HMA or IRMA present, one eye", "description_both_eyes": "Lesions as above + either extensive or severe HMA or IRMA present, both eyes"},
        {"score": 47, "label": "Moderately severe NPDR", "description_one_eye": "Lesions of 35 + either extensive or severe HMA with IRMA or venous beading, one eye", "description_both_eyes": "Lesions of 35 + either extensive or severe HMA with IRMA or venous beading, both eyes"},
        {"score": 53, "label": "Severe NPDR", "description_one_eye": "Extensive and severe HMA, IRMA, and/or venous beading, one eye", "description_both_eyes": "Extensive and severe HMA, IRMA, and/or venous beading, both eyes"},
        {"score": 61, "label": "Proliferative DR", "description_one_eye": "NVD and/or NVE without or with complication", "description_both_eyes": "NVD and/or NVE without or with complication"}
    ]

    # Helper to find closest ETDRS step
    def get_etdrs_info(score):
        closest = min(etdrs_info, key=lambda x: abs(x["score"] - score))
        return closest

    # Preprocess the input image
    image_tensor = transform(image).unsqueeze(0).to(device)

    # Model inference (no gradient calculation needed)
    with torch.no_grad():
        output = model(image_tensor)  # Get raw model output
        probabilities = torch.nn.functional.softmax(output[0], dim=0)  # Convert to probabilities

    # Get the predicted class index and its confidence
    predicted_index = torch.argmax(probabilities).item()
    confidence = probabilities[predicted_index].item()

    # Probability-based ETDRS score calculation
    etdrs_score = sum([p * info["score"] for p, info in zip(probabilities.tolist(), etdrs_info)])
    etdrs_details = get_etdrs_info(etdrs_score)

    # For demo, always return 'both eyes' description (can be customized)
    etdrs_label = etdrs_details["label"]
    etdrs_description = etdrs_details["description_both_eyes"]

    # GradCAM logic for visual explanation
    # Prepare image for overlay
    rgb_img = np.array(image.resize((300, 300)))  # Resize and convert to numpy array
    rgb_img_float = np.float32(rgb_img) / 255.0  # Normalize to [0, 1]
    target_layers = [model.features[-1]]  # Last feature layer for GradCAM
    cam = GradCAM(model=model, target_layers=target_layers)  # Initialize GradCAM
    targets = [ClassifierOutputTarget(predicted_index)]  # Target the predicted class
    grayscale_cam = cam(input_tensor=image_tensor, targets=targets)[0]  # Get GradCAM mask
    visualization = show_cam_on_image(rgb_img_float, grayscale_cam, use_rgb=True)  # Overlay mask

    # Convert GradCAM visualization to base64 string for easy transport
    from PIL import Image as PILImage
    vis_pil = PILImage.fromarray(visualization)
    buffered = io.BytesIO()
    vis_pil.save(buffered, format="PNG")
    gradcam_base64 = base64.b64encode(buffered.getvalue()).decode()

    # --- Save the input image to the predictions folder ---
    predictions_dir = "predictions"
    os.makedirs(predictions_dir, exist_ok=True)
    file_name = f"{uuid.uuid4().hex}.png"
    file_path = os.path.join(predictions_dir, file_name)
    image.save(file_path)

    # Return prediction results as a dictionary
    return {
        "dr_class": classes[predicted_index],  # Predicted DR class label
        "confidence": round(confidence, 4),    # Confidence score
        "gradcam": gradcam_base64,             # GradCAM visualization (base64)
        "etdrs_score": round(etdrs_score, 2),
        "etdrs_label": etdrs_label,
        "etdrs_description": etdrs_description,
        "file_name": file_name,
        "file_path": file_path
    }
