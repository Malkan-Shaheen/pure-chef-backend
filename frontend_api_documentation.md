# PureChef API Documentation for Frontend

This document outlines all the available REST API endpoints for the PureChef backend, including required headers, request bodies, and expected responses. This serves as a comprehensive guide for the frontend team to integrate the backend services.

## Base URL
Assuming local development, the base URL is:
`http://localhost:3000/api`

Or your production URL:
`https://your-production-url.com/api`

---

## Global Authentication Headers
All endpoints **except** the Auth endpoints (`/auth/signup` and `/auth/login`) require a valid JSON Web Token (JWT) in the `Authorization` header.

**Required Header for Protected Routes:**
```json
{
  "Authorization": "Bearer <YOUR_JWT_TOKEN>"
}
```

---

## 1. Authentication (Auth) Routes

### 1.1 Signup
Create a new user account.

- **URL:** `/auth/signup`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "User created successfully!",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
  }
  ```
- **Error Responses:** 
  - `400 Bad Request` (Email already exists): `{ "error": "Email already exists." }`

### 1.2 Login
Authenticate an existing user and get a JWT.

- **URL:** `/auth/login`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`
- **Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "securepassword"
  }
  ```
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Login successful!",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI..."
  }
  ```
- **Error Responses:** 
  - `401 Unauthorized`: `{ "error": "Invalid email or password." }`

---

## 2. AI Routes (Protected)
*Don't forget the `Authorization: Bearer <TOKEN>` header!*

### 2.1 Detect Ingredients (From Fridge Image)
Upload an image of a fridge/pantry, and Gemini AI will return a list of detected ingredients.

- **URL:** `/ai/detect-ingredients`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`, `Authorization: Bearer <TOKEN>`
- **Body (`multipart/form-data`):**
  - `fridgeImage`: (File / Image) The picture to analyze.
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "ingredients": [
      "Chicken Breast",
      "Eggs",
      "Milk",
      "Tomato",
      "Lettuce",
      "Cheese"
    ]
  }
  ```
- **Error Responses:** 
  - `400 Bad Request`: `{ "error": "No fridge picture uploaded!" }`
  - `500 Server Error`: `{ "error": "Failed to detect ingredients: ..." }`

### 2.2 Generate Recipes (Text-Based)
Send a list of ingredients and a mood to generate 3 unique recipes.

- **URL:** `/ai/generate-recipes`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <TOKEN>`
- **Body:**
  ```json
  {
    "mood": "healthy and light", 
    "ingredients": "Salmon, Spinach, Lemon, Olive Oil"
  }
  ```
  *(Note: Both fields are optional. They default to "hungry" and "none" respectively.)*
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "recipes": [
      {
        "title": "Lemon Spinach Salmon",
        "description": "A light and zesty salmon dish.",
        "time": "20 mins",
        "calories": "350 kcal",
        "protein": "30g",
        "carbs": "5g",
        "match": "Perfect Match",
        "ingredients": [
          { "name": "Salmon Fillets", "amount": "2 portions" },
          { "name": "Fresh Lemon", "amount": "1 large" }
        ],
        "instructions": [
          "Preheat oven to 400°F (200°C).",
          "Season the fillets and squeeze lemon juice.",
          "Bake for 12-15 minutes."
        ]
      }
      // ... (Returns exactly 3 recipes)
    ]
  }
  ```

### 2.3 Analyze Fridge (Legacy / Comprehensive)
Upload an image along with mood/manual ingredients to directly get 3 recipes back.

- **URL:** `/ai/analyze-fridge`
- **Method:** `POST`
- **Headers:** `Content-Type: multipart/form-data`, `Authorization: Bearer <TOKEN>`
- **Body (`multipart/form-data`):**
  - `fridgeImage`: (File / Image) 
  - `mood`: (Text - optional) e.g., "spicy"
  - `ingredients`: (Text - optional) e.g., "I also have some rice."
- **Success Response (200 OK):**
  Same structure as `generate-recipes` (Returns 3 recipe objects).

---

## 3. Recipe (Cookbook) Routes (Protected)
*Don't forget the `Authorization: Bearer <TOKEN>` header!*

### 3.1 Fetch All Saved Recipes
Get all recipes saved by the currently logged-in user.

- **URL:** `/recipes/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "recipes": [
      {
        "_id": "60d5ecb8b392...",
        "userId": "60d5ecb8b392...",
        "title": "Lemon Spinach Salmon",
        "description": "A light and zesty salmon dish.",
        "time": "20 mins",
        "calories": "350 kcal",
        "protein": "30g",
        "carbs": "5g",
        "ingredients": [ ... ],
        "instructions": [ ... ],
        "createdAt": "2023-10-25T10:00:00.000Z",
        "__v": 0
      }
    ]
  }
  ```

### 3.2 Save a New Recipe
Save a recipe to the user's cookbook.

- **URL:** `/recipes/save-recipe`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <TOKEN>`
- **Body:**
  *(Pass the exact recipe object received from the AI endpoints)*
  ```json
  {
    "title": "Lemon Spinach Salmon",
    "description": "A light and zesty salmon dish.",
    "time": "20 mins",
    "calories": "350 kcal",
    "protein": "30g",
    "carbs": "5g",
    "ingredients": [ { "name": "Salmon", "amount": "2 portions" } ],
    "instructions": [ "Preheat oven...", "Bake..." ]
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Saved to Cookbook!"
  }
  ```

### 3.3 Delete a Recipe
Remove a recipe from the user's cookbook.

- **URL:** `/recipes/:id` (e.g., `/recipes/60d5ecb8b392...`)
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Recipe deleted!"
  }
  ```
- **Error Responses:** 
  - `404 Not Found`: `{ "error": "Recipe not found or not authorized." }`

---

## 4. Pantry Routes (Protected)
*Don't forget the `Authorization: Bearer <TOKEN>` header!*

### 4.1 Fetch Pantry Items
Get all ingredients currently in the user's pantry.

- **URL:** `/pantry/`
- **Method:** `GET`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "items": [
      {
        "_id": "60d5ecb8b400...",
        "userId": "60d5ecb8b392...",
        "name": "Eggs",
        "createdAt": "2023-10-25T10:05:00.000Z",
        "__v": 0
      }
    ]
  }
  ```

### 4.2 Add Ingredients to Pantry
Add one or more ingredients to the pantry.

- **URL:** `/pantry/`
- **Method:** `POST`
- **Headers:** `Content-Type: application/json`, `Authorization: Bearer <TOKEN>`
- **Body:**
  ```json
  {
    "ingredients": ["Apple", "Milk", "Bread"]
  }
  ```
- **Success Response (201 Created):**
  ```json
  {
    "success": true,
    "message": "Added 3 items to pantry."
  }
  ```
- **Error Responses:** 
  - `400 Bad Request`: `{ "error": "Please provide an array of ingredients." }`

### 4.3 Delete a Pantry Item
Remove a specific ingredient from the pantry.

- **URL:** `/pantry/:id` (e.g., `/pantry/60d5ecb8b400...`)
- **Method:** `DELETE`
- **Headers:** `Authorization: Bearer <TOKEN>`
- **Success Response (200 OK):**
  ```json
  {
    "success": true,
    "message": "Ingredient removed!"
  }
  ```
- **Error Responses:** 
  - `404 Not Found`: `{ "error": "Ingredient not found or not authorized." }`
