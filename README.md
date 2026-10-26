# Наши фильмы

Общий список фильмов и сериалов для просмотра вдвоём. У каждого свой аккаунт, список общий, у каждой записи два статуса: «хотим посмотреть» и «посмотрели». Данные о фильмах и сериалах и постеры берутся из TMDB.

Стек: Next.js 16 (Vercel) + Supabase (вход и база данных) + TMDB API.

## Настройка

### 1. Supabase
1. Создай проект на [supabase.com](https://supabase.com).
2. **SQL Editor** → по очереди вставь и выполни (**Run**) все файлы из `supabase/migrations/` по порядку номеров.
3. **Authentication → Sign In / Providers → Email**: для простоты выключи **Confirm email** (иначе после регистрации нужно подтверждать почту).
4. **Project Settings → API**: скопируй `Project URL` и `anon public` ключ.

### 2. TMDB
1. Зарегистрируйся на [themoviedb.org](https://www.themoviedb.org) и запроси API-ключ в **Settings → API**.
2. Скопируй **API Read Access Token** (длинный токен).

### 3. Локальный запуск
```bash
cp .env.example .env.local   # и заполни значения
npm install
npm run dev
```

### 4. Деплой на Vercel
1. **Add New → Project** → импортируй этот репозиторий.
2. В **Environment Variables** добавь `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `TMDB_API_TOKEN`.
3. **Deploy**.

## Как пользоваться
1. Один из вас регистрируется и нажимает «Создать новый список».
2. На главной странице виден код приглашения: второй регистрируется и вводит этот код.
3. Ищите фильмы и сериалы, добавляйте их и отмечайте просмотренные.
