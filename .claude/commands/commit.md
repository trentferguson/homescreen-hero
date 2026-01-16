# Commit Changes

Review all staged and unstaged changes, then create a well-formatted commit.

## Instructions

1. Run `git status` to see all changes
2. Run `git diff` to review unstaged changes and `git diff --cached` for staged changes
3. Run `git log --oneline -5` to see recent commit message style
4. Stage all relevant changes (ask me if unsure what to include)
5. Write a concise commit message that:
   - Follows the existing commit style in this repo, with more specific style guide below in the 'Commit Style' section.
6. You do not need to add tiny changes to commit messages. For example, if we moved and icon to a different part of card in the UI, that doesn't need to be noted at all.
7. Create the commit
8. Show the result with `git status`

### Commit Style
1. Do not use bullet points or dashes simply separate points, simply separate different points with new lines.
2. Keep things brief, separate items in one commit should be explained in no more than two sentences, but ideally in one.
3. Use normal human language/tone like "Added ..." or "Fixed ..."
4. Don't include any reference to the commit being written by Claude, as we want to keep these commit messages short.

Always ask me for permission before commiting.
