"""
SmartShelf Pydantic Data Models and Validation Schemas.
"""

from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

class UserAuth(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    name: str
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: int
    name: str
    email: str

class HouseholdCreate(BaseModel):
    name: str

class HouseholdJoin(BaseModel):
    share_code: str

class ProductCreate(BaseModel):
    name: str
    brand: Optional[str] = None
    category: str
    quantity: int = 1
    unopened_quantity: int = 1
    in_use_quantity: int = 0
    price: float = 0.0
    purchase_date: Optional[str] = None
    opened_date: Optional[str] = None
    expiry_date: Optional[str] = None
    visibility: str = "shared" # shared or personal
    barcode: Optional[str] = None
    image_url: Optional[str] = None

class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    quantity: Optional[int] = None
    unopened_quantity: Optional[int] = None
    in_use_quantity: Optional[int] = None
    price: Optional[float] = None
    expiry_date: Optional[str] = None
    visibility: Optional[str] = None

class ProductStatusChange(BaseModel):
    action: str # "start_using", "mark_finished", "mark_wasted", "add_unit"
    waste_reason: Optional[str] = None

class PurchaseEvaluationRequest(BaseModel):
    product_name: str
    category: str = "Personal Care"
    price: float
    quantity: int = 1

class IngredientAnalysisRequest(BaseModel):
    ingredient_text: Optional[str] = None
    image_base64: Optional[str] = None

class ProductClassifyRequest(BaseModel):
    image_base64: Optional[str] = None
    filename: Optional[str] = None
    text_hint: Optional[str] = None
