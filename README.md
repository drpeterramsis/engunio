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

## Version 1.0.006 Updates
- Refactored the UI into three main tabs: Setup, Practice, and History.
- Updated the Practice tab to display all generated questions on a single page with a single "Submit All Answers" button.
- Implemented a congratulatory confetti animation and a shareable Certificate of Achievement for scores of 90% and above.
- Added a new grammar category "Academy Series Grammar" based on the provided PDF rules (Pronouns, Wh- Questions, Tenses, Conditionals, etc.).
- Fixed a build error caused by a syntax issue in the JSX structure.
- Updated version number to v1.0.006.

## Version 1.0.007 Updates
- Professionalized the fixed footer with contact information and versioning.
- Added a visual progress bar for the question generation process.
- Implemented an option to choose between "Question by Question" or "Full Exam" modes.
- Added PDF upload functionality to generate questions directly from uploaded documents.
- Added a "Clear Search" (X) button to the filter bar for easier navigation.
- Introduced a "Fast Lesson" card providing quick explanations and examples for grammar rules.
- Added a "Full Summary" feature for uploaded PDFs, providing bilingual (Arabic/English) tables and instructions.
- Implemented a "Listening Comprehension" question type with Text-to-Speech capabilities.
- Updated version number to v1.0.007.

## Version 1.0.008 Updates
- Refined the "Practice" tab logic to correctly separate "Exam" and "Question-by-Question" modes.
- Added "Previous", "Next", "Check Answer", and "Finish Session" buttons for the "Question-by-Question" mode.
- Integrated a comprehensive submission process for both modes, ensuring accurate scoring and history tracking.
- Prevented double rendering of questions and submission buttons once a session is submitted.
- Fixed a bug where the question index was not reset when generating new questions.
- Updated version number to v1.0.008 in the footer and metadata.

## Version 1.0.009 Updates
- **Academy Series Library Integration**: Added a dedicated "Library" tab to view summarized grammar rules from the Academy Series PDF.
- **Bilingual Grammar Summaries**: The Library tab provides comprehensive English explanations with Arabic translations, categorized into logical sectors (Pronouns, Tenses, etc.).
- **Conditional Question Generation**: Added a toggle in the "Setup" tab to focus question generation specifically on the Academy Series Library content.
- **Enhanced UI/UX**: Improved the navigation with a new "Library" tab and refined the layout for better readability of grammar rules.
- **Version Number Update**: Updated the application version to v1.0.009 across all configuration files and the footer.

## Version 1.0.010 Updates
- **Collapsible History**: Grouped exam attempts by date with expand/collapse functionality for better organization.
- **Removed PDF Integration**: Disabled and removed the PDF upload and analysis features.
- **Professional Listening Questions**: Enhanced AI prompt to generate natural dialogues and complete sentences for listening comprehension.
- **Default Selection**: Set "Present Simple" as the default grammar rule.
- **Local Persistence**: User selections for grammar rules and question types are now stored locally and persist across sessions.
- **Version Update**: Updated application version to 1.0.010.

## Version 1.0.011 Updates
- **Enhanced Listening Audio**: Improved the AI prompt to generate "small action" sentences for listening comprehension.
- **Audio Playback Control**: Added a "Stop" button (toggles with Listen) to allow users to cancel speech playback.
- **Clean Speech**: Implemented logic to strip underscores and dots from text before reading aloud, ensuring a more natural listening experience.
- **Version Update**: Updated application version to 1.0.011.

## Version 1.0.012 Updates
- **Smart History Collapsing**: History sessions are now collapsed by default, except for the most recent one.
- **Detailed Feedback in History**: Added question type tags and comprehensive explanations for incorrect answers (why it's wrong, correct answer, and rule explanation).
- **Grammar Flash Cards**: Introduced a dynamic "Flash Card" section in the setup tab for quick grammar tips.
- **UX Improvements**: Implemented "click outside" detection to automatically collapse grammar rule and question type selection menus.
- **Design Overhaul**: Enhanced the overall UI with more professional gradients, shadows, and smooth motion animations.
- **Version Update**: Updated application version to 1.0.012.

## Version 1.0.013 Updates
- **History Session Summary**: Added a visual summary of correct and wrong answers to each session header in the History tab.
- **IELTS-style Listening**: Enhanced listening comprehension to include a context paragraph (dialogue or story) before the question, mimicking standard English exams like IELTS.
- **Version Update**: Updated application version to 1.0.013.

## Version 1.0.014 Updates
- **Focused Listening Experience**: In listening mode, the audio now only reads the context paragraph (dialogue or story). The question itself is displayed on the screen but not read aloud, allowing students to focus their listening effort on the relevant information.
- **Version Update**: Updated application version to 1.0.014.

## Version 1.0.015 Updates
- **Voice Selection**: Users can now choose from a list of available system voices for text-to-speech, including female voices if available on the device.
- **Speech Speed Control**: Added a speed slider (0.5x to 2.0x) to control the rate of listening comprehension audio.
- **Persistent Settings**: Voice and speed preferences are automatically saved to local storage and restored on next visit.
- **Version Update**: Updated application version to 1.0.015.

## Version 1.0.016 Updates
- **Grouped Listening Options**: All listening-related settings (toggle, voice, and speed) are now grouped into a single "Listening Comprehension" category.
- **Conditional Activation**: Voice and speed controls are now only visible and active when Listening Comprehension is enabled, reducing UI clutter.
- **Mobile-Friendly Question Count**: Added plus (+) and minus (-) buttons to the question count input for easier adjustment on mobile devices. Also implemented "select on focus" for the input field.
- **Version Update**: Updated application version to 1.0.016.

## Version 1.0.017 Updates
- **Mobile Footer Spacing**: Added a spacer element to prevent the fixed footer from overlapping with the "Submit Answers" button and other critical UI elements on mobile devices.
- **Comprehensive Printing**:
  - **History Summary**: Added a "Print All Summary" button to the History tab, generating a detailed report of all user activity, including attempts, correct/wrong counts, and total duration.
  - **Session Reports**: Each individual session in the history can now be printed as a standalone report.
  - **Practice & Exams**: Users can print their current practice session, or generate clean "Exam Papers" (questions only) and "Model Answer Keys" (questions with answers and explanations).
- **Teacher Mode**:
  - **Exam Generation**: Introduced a "Teacher Mode" toggle in the Setup tab. When enabled, teachers can generate and print separate PDFs for exams and answer keys to send to students.
  - **Auto-Correction**: Teachers can upload a student's completed work (PDF or image) to automatically extract answers using AI and grade them against the current session.
- **Session Duration**: The app now tracks and records the duration of each practice session, displaying it in the history reports.
- **Version Update**: Updated application version to 1.0.017 across all configuration files and the UI footer.

## Version 1.0.018 Updates
- **Refined Listening Settings**: Grouped listening comprehension settings (voice, speed) directly under the "Listening Comprehension" question type selection. These settings are now only visible when the listening type is selected, streamlining the setup process.
- **Print Preview Modal**: Introduced a professional print preview modal that appears before printing. Users can now adjust the font size (8px to 24px) to ensure the exam fits perfectly on the page.
- **Fixed Printing Issues**: Resolved a bug where not all questions were included in the printed output. Also implemented logic to hide scrollbars and optimize page breaks for multi-page exams.
- **Enhanced Print Styling**: Applied global print-specific CSS to ensure clean, professional-looking reports and exams with proper margins and color adjustments.
- **Version Update**: Updated application version to 1.0.018 across all configuration files and the UI footer.

## Version 1.0.024 Updates
- **Question Tagging**: Replaced the generic "Mixed Practice" tag with the specific question type (e.g., MCQ, Rewrite) for better clarity, using a new `type` field in the question data.
- **Prompt Refinement**: Updated AI generation prompt to enforce inclusion of the `type` field in JSON output.
- **Version Update**: Updated application version to 1.0.024 across all configuration files and the UI footer.

## Version 1.0.023 Updates
- **Robust JSON Parsing**: Implemented a robust JSON extraction and parsing utility to handle OpenRouter model responses, ensuring stability even when models include conversational filler.
- **Prompt Optimization**: Refined system instructions to enforce strict JSON-only output for OpenRouter models.
- **API Key Fix**: Updated API key retrieval to prioritize `VITE_OPENROUTER_API_KEY` for client-side access, ensuring compatibility with environment variables.
- **Printing Font Control**: Fixed print font size control to apply to all elements, including choices.
- **Listening Comprehension Fix**: Restored and refined listening comprehension question generation.
- **Version Update**: Updated application version to 1.0.023 across all configuration files and the UI footer.
