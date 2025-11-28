// src/services/auth.js
export async function login(userId) {
  const formData = new FormData();
  formData.append("user_id", userId);

  const res = await fetch("http://127.0.0.1:8000/api/login", {
    method: "POST",
    body: formData,
  });

  if (!res.ok) throw new Error("Login failed");
  const data = await res.json();

  // Save token in localStorage
  localStorage.setItem("jwt", data.access_token);
  return data;
}