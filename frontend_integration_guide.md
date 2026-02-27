# PureChef Frontend Integration Guide

Since the backend has been migrated to an MVC architecture and secured with JWT (JSON Web Tokens), you need to update the Flutter application to authenticate and securely access the user's data.

## 1. Authentication Flow
Endpoints are no longer open to the public without context. A user must log in.

### A. Signup
- **Endpoint:** `POST /api/auth/signup`
- **Body:** `{ "email": "user@example.com", "password": "securepassword" }`
- **Response:** `{ "success": true, "token": "eyJh..." }`

### B. Login
- **Endpoint:** `POST /api/auth/login`
- **Body:** `{ "email": "user@example.com", "password": "securepassword" }`
- **Response:** `{ "success": true, "token": "eyJh..." }`

Store this returned `token` securely in your app. You can use the `flutter_secure_storage` package to persist the token across app restarts.

## 2. Updated API Endpoints
All existing resource endpoints have been moved under segmented base paths, and they **require** the token to be sent in the `Authorization` header.

### Bearer Token Header
Add this header to all authenticated requests (AI, recipes, pantry):
```dart
headers: {
  'Content-Type': 'application/json',
  'Authorization': 'Bearer YOUR_SAVED_TOKEN_HERE' 
}
```
*(If you are sending a Multipart request like for images, let HTTP libraries handle the `Content-Type` automatically, but ensure `Authorization` is attached.)*

### Endpoint Changes

| Feature | Old URL | New URL | Needs Auth? |
| --- | --- | --- | --- |
| Detect Ingredients | `/api/detect-ingredients` | `/api/ai/detect-ingredients` | Yes |
| Generate Recipes | `/api/generate-recipes` | `/api/ai/generate-recipes` | Yes |
| Analyze Fridge | `/api/analyze-fridge` | `/api/ai/analyze-fridge` | Yes |
| Save Recipe | `/api/save-recipe` | `/api/recipes/save-recipe` | Yes |
| Get Cookbook | `/api/recipes` | `/api/recipes/` | Yes |
| Delete Recipe | `/api/recipes/:id` | `/api/recipes/:id` | Yes |
| Add to Pantry | `/api/pantry` | `/api/pantry/` | Yes |
| Get Pantry | `/api/pantry` | `/api/pantry/` | Yes |
| Delete Pantry Item | `/api/pantry/:id` | `/api/pantry/:id` | Yes |

### 3. Quick Checklist for Flutter Updates:
1. Build a basic Login / Signup UI to collect `email` and `password`.
2. Hit the `/api/auth/login` endpoint and save the token securely.
3. Update ALL of your existing API URLs in your dart HTTP requests to match the "New URL" column above.
4. Inject the `Authorization: Bearer <token>` header into all existing HTTP requests. Users will now have independent, personal pantries and cookbooks!
