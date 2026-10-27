# ALASSAUL-AI — Brain Capabilities V11

Date: 2026-10-14

## Added

1. **Conversation photo attachment**
   - Added a camera/photo control to the chat composer using the device image picker and `capture="environment"` hint for mobile rear-camera capture.
   - Compresses selected images in the browser to JPEG, maximum dimension 1280 px, and rejects oversized inputs before upload.
   - Shows an in-chat preview and lets the visitor remove it before sending.
   - Sends the image only with the current user turn; older image data is not resent as part of later chat history.
   - The image is sent to the configured model provider for analysis; this feature does not save it to the ALASSAUL guestbook/media database.

2. **Vision request serialization**
   - Server validates data URLs as JPEG/PNG/WEBP and applies a request-size bound.
   - Chat-completions requests retain the standard `image_url` part.
   - Responses API requests now serialize image parts as `input_image` instead of converting the image object into plain text.
   - The system prompt asks the model to distinguish visible evidence from inference and to avoid inventing details.

3. **Current news headlines**
   - Recognizes current-news queries in Arabic, Turkish, and English.
   - Attempts to fetch a small set of headlines from Google News RSS with a 4.5-second timeout.
   - Includes publisher, publication time when available, and article links; chat links are clickable.
   - If the feed cannot be reached, the assistant explicitly says live news could not be verified rather than fabricating headlines.

4. **Tests and UI**
   - Added a camera/image attachment UI test.
   - Added an adaptive-instruction test for time-sensitive news and a server test for forwarding an image as vision content.
   - Added a news-intent response strategy and a default prompt for world news/photo analysis.

## Verification status

- ZIP archive integrity and TypeScript parser/syntax scan are checked before packaging.
- Full dependency-backed tests and production build are **not verified** because project dependencies are unavailable in this environment.
- Live RSS connectivity and actual model vision capability require deployment/runtime testing. The model provider configured for deployment must support image input for photo analysis to work end-to-end.
- This package is not deployed to the live website.
