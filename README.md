# ENGUNIO

**ENGlish Upgrade Now — Interactive Online**

An AI-powered English learning platform that generates custom questions based on grammar rules and lesson content.

## Features
- **User Setup**: Saves your name and progress locally.
- **Dashboard**: Configure grammar rules, question types, and difficulty.
- **Question Engine**: Uses Google Gemini AI to generate unique questions.
- **Answer System**: Validates answers and provides detailed explanations.
- **Score System**: Tracks your total score and attempts.
- **Lesson Upload**: Upload a JSON file with lesson content to base questions on.
- **History**: Review previous attempts and mistakes.

## Deployment to Vercel

This project is ready to be deployed to Vercel as a static frontend application.

### Prerequisites
1. A GitHub account.
2. A Vercel account (linked to your GitHub).
3. A Google Gemini API Key.

### Step 1: Push to GitHub
1. Initialize a git repository in your project folder:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```
2. Create a new repository on GitHub.
3. Link your local repository to GitHub and push:
   ```bash
   git remote add origin <your-repo-url>
   git branch -M main
   git push -u origin main
   ```

### Step 2: Import to Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **Add New...** > **Project**.
3. Import the repository you just created on GitHub.

### Step 3: Configure Environment Variables
During the Vercel import process, you will see an "Environment Variables" section.
1. Add a new variable:
   - **Name**: `VITE_GEMINI_API_KEY` (or `GEMINI_API_KEY` depending on your Vite config)
   - **Value**: Your actual Google Gemini API Key.
2. Ensure the framework preset is set to **Vite**.

### Step 4: Deploy
1. Click the **Deploy** button.
2. Vercel will automatically build your project (running `npm run build` to minify JS/CSS and optimize assets).
3. Once finished, you will get a live URL for your application!

### Performance & Optimization
- **Vite** automatically minifies JavaScript and CSS during the build process.
- The `vercel.json` file is included to handle client-side routing (SPA fallback).
- Assets are optimized and served via Vercel's Edge Network for fast loading.

## Version 1.0.001 Updates
- Added a footer with copyright information and version number.
- Added a "Reset Progress" button in the new Settings menu.
- Expanded grammar rules and added the ability to select multiple rules simultaneously.
- Added the ability to select multiple question types simultaneously.
- Added an option to generate a batch of multiple questions at once.
- Preserved history and scoring board functionality for batch questions.
- Added a Settings menu to change the webapp's theme color dynamically.
- Updated the app icon to a Rocket to better match the "Upgrade Now" slogan.

## Version 1.0.002 Updates
- Fixed theme color changing functionality by applying themes to the document body.
- Fixed "Failed to generate questions" error by improving API key loading and adding detailed error messages.
- Collapsed Grammar Rules and Question Types by default with summary counts.
- Removed the lesson content upload option to streamline the interface.
- Updated version number in footer to v1.0.002.

## Version 1.0.003 Updates
- Categorized grammar rules into Tenses, Parts of Speech, Sentence Structure, and Advanced & Vocabulary.
- Sorted all grammar rules and question types alphabetically.
- Added missing comprehensive grammar rules and question types (Matching, True/False, Sentence Ordering, etc.).
- Fixed theme colors not applying to buttons and UI elements by defining CSS variables for all themes in index.css.
- Updated version number to v1.0.003.

## Version 1.0.004 Updates
- Fixed the Gemini API quota exceeded error by switching the model to `gemini-3-flash-preview` which has higher free tier limits.
- Added a search/filter bar to the Grammar Rules and Question Types sections to easily find specific rules and types.
- Fixed the theme color selection for buttons and UI elements by updating Tailwind v4 CSS variables mapping.
- Updated version number to v1.0.004.

## Version 1.0.005 Updates
- Fixed the "Generate Questions" button color to properly apply the selected theme.
- Hid the grammar rule and difficulty level on the question card until after the user submits their answer.
- Grouped the history section by date and exam session for better organization.
- Added more animations and professional design elements to the web app using Framer Motion.
- Updated version number to v1.0.005.
