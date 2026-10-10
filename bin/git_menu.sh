#!/bin/bash

# Git Menu for macOS/Linux
# A shell script version of git_menu.bat

# Function to display menu
show_menu() {
    echo "==============================="
    echo "        Git Menu"
    echo "==============================="
    echo "0. Init Repo    1. Status    2. Add    3. Commit    4. Push    5. Pull"
    echo "6. Log       7. Remove file    8. Show commit    9. Remove file from GitHub    10. View Branches"
    echo "11. Checkout Remote Branch    12. Switch Branch    13. View Tags    14. Discard Changes"
    echo "15. Force unstage (git rm --cached -f)    16. Create Branch + Commit    17. Undo Last Commit"
    echo "99. Exit"
    echo
}

# Function to initialize repository
init_repo() {
    echo "--- Initialize Git Repository ---"
    
    # Check if already a git repository
    if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo "Current directory is already a Git repository!"
        return
    fi
    
    git init
    echo "Repository initialized."
    
    read -p "Enter GitHub repository URL (e.g., https://github.com/xxx/yyy.git): " remoteurl
    if [ -z "$remoteurl" ]; then
        echo "Repository URL cannot be empty!"
        return
    fi
    
    git add .
    echo "Files added."
    
    read -p "Enter first commit message: " firstmsg
    if [ -z "$firstmsg" ]; then
        firstmsg="first commit"
    fi
    
    git commit -m "$firstmsg"
    git branch -M main
    git remote add origin "$remoteurl"
    echo "Pushing to remote repository..."
    git push -u origin main
    echo "Initialization and push completed."
}

# Function to show status
show_status() {
    echo "--- Git Status ---"
    git status
}

# Function to add all changes
add_changes() {
    echo "--- Add All Changes ---"
    git add .
    echo "All changes have been added."
}

# Function to commit changes
commit_changes() {
    echo "--- Commit Changes ---"
    read -p "Enter commit message: " msg
    if [ -z "$msg" ]; then
        echo "Commit message cannot be empty!"
        return
    fi
    git commit -m "$msg"
}

# Function to push to remote
push_to_remote() {
    echo "--- Push to Remote ---"
    git push
}

# Function to pull from remote
pull_from_remote() {
    echo "--- Pull from Remote ---"
    git pull
}

# Function to show log
show_log() {
    echo "--- Git Log (last 5 commits) ---"
    git log -5 --oneline
}

# Function to remove file from git index
remove_file() {
    echo "--- Remove tracked file from git index ---"
    read -p "Enter the file name to remove from git index: " rmfile
    if [ -z "$rmfile" ]; then
        echo "File name cannot be empty!"
        return
    fi
    git rm --cached "$rmfile"
}

# Function to show commit details
show_commit() {
    echo "--- Last Commit Details (git show) ---"
    echo "(Tip: Press q to quit and return to menu)"
    git show
}

# Function to remove file from GitHub
remove_file_github() {
    echo "--- Remove file from GitHub (local+remote) ---"
    read -p "Enter the file name to remove from GitHub: " rmfile2
    if [ -z "$rmfile2" ]; then
        echo "File name cannot be empty!"
        return
    fi
    git rm "$rmfile2"
    echo "File removed locally. Now committing..."
    read -p "Enter commit message for file removal: " msg2
    if [ -z "$msg2" ]; then
        msg2="remove file $rmfile2"
    fi
    git commit -m "$msg2"
    echo "Pushing to remote..."
    git push
    echo "File $rmfile2 has been removed from local and remote repository."
}

# Function to view branches
view_branches() {
    echo "--- View Branches ---"
    echo "Local branches:"
    git branch
    echo
    echo "Remote branches:"
    git branch -r
    echo
    echo "All branches:"
    git branch -a
}

# Function to checkout a remote branch to local
checkout_remote() {
    echo "--- Checkout Remote Branch ---"
    echo "Fetching remote branches..."
    git fetch origin
    echo
    echo "Remote branches:"
    git branch -r
    echo
    echo "Tip: Enter branch name only, e.g. perf/p0-dtw-band-resample-numpy"
    echo "     (no need to include \"origin/\" prefix)"
    echo
    read -p "Enter remote branch name: " remote_branch
    if [ -z "$remote_branch" ]; then
        echo "Branch name cannot be empty!"
        return
    fi
    # 自动去掉用户误输入的 "origin/" 前缀
    remote_branch="${remote_branch#origin/}"
    if git checkout -b "$remote_branch" "origin/$remote_branch"; then
        echo "Successfully checked out remote branch: $remote_branch"
    else
        echo "Failed. Branch may already exist locally. Try option 12 to switch to it."
    fi
}

# Function to switch branch
switch_branch() {
    echo "--- Switch Branch ---"
    echo "Current branch:"
    git branch --show-current
    echo
    echo "Available branches:"
    git branch
    echo
    read -p "Enter branch name to switch to: " branch_name
    if [ -z "$branch_name" ]; then
        echo "Branch name cannot be empty!"
        return
    fi
    if git checkout "$branch_name"; then
        echo "Successfully switched to branch: $branch_name"
    else
        echo "Failed to switch branch, please check if the branch name is correct"
    fi
}

# Function to view tags
view_tags() {
    echo "--- View Tags ---"
    echo "Local tags:"
    git tag
    echo
    echo "Remote tags:"
    git ls-remote --tags origin
}

# Function to discard changes
discard_changes() {
    echo "--- Discard Local Changes ---"
    echo "Warning: This will discard all local changes and cannot be undone!"
    echo "This will reset tracked files to HEAD and remove untracked files."
    read -p "Are you sure you want to discard all changes? (y/n): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        git reset --hard HEAD
        git clean -fd
        echo "All local changes have been discarded."
    else
        echo "Operation cancelled."
    fi
}

# Function to force remove path from staging index
remove_cached_force() {
    echo "--- Force Remove from Staging Index (git rm --cached -f) ---"
    echo "Tip: Use this to unstage mistakenly added paths (e.g. nested git repos)."
    echo "     Local files will NOT be deleted."
    read -p "Enter file or directory path to force-unstage: " rmfile_force
    if [ -z "$rmfile_force" ]; then
        echo "Path cannot be empty!"
        return
    fi
    if git rm --cached -f "$rmfile_force"; then
        echo "Successfully removed from staging index: $rmfile_force"
    else
        echo "Failed to remove from staging index. Check path and git status."
    fi
}

# Function to create a new branch and commit current changes (A1 + B1)
create_branch_commit() {
    echo "--- Create Branch + Commit Current Changes ---"
    echo "Current branch:"
    git branch --show-current
    echo
    echo "Working tree status:"
    git status -sb
    echo
    echo "Tip: Branch name should be ASCII slug, e.g. feat/scheme2-occ-correspondence"
    echo "     Commit message can be Chinese or English title/description."
    echo
    read -p "Enter new branch name: " branch_name
    if [ -z "$branch_name" ]; then
        echo "Branch name cannot be empty!"
        return
    fi
    if git show-ref --verify --quiet "refs/heads/$branch_name"; then
        echo "Branch already exists locally: $branch_name"
        echo "Use option 12 to switch, or choose a different name."
        return
    fi
    if ! git checkout -b "$branch_name"; then
        echo "Failed to create branch: $branch_name"
        return
    fi
    echo "Created and switched to branch: $branch_name"
    echo
    read -p "Stage all changes with git add . ? (y/n): " confirm_add
    if [[ ! "$confirm_add" =~ ^[Yy]$ ]]; then
        echo "Operation cancelled after creating branch. You are on: $branch_name"
        return
    fi
    git add .
    echo
    read -p "Enter commit message: " msg
    if [ -z "$msg" ]; then
        msg="feat: $branch_name"
    fi
    if ! git commit -m "$msg"; then
        echo "Commit failed. Branch exists: $branch_name"
        return
    fi
    echo "Commit completed on branch: $branch_name"
    echo
    read -p "Push branch to origin with -u? (y/n): " confirm_push
    if [[ "$confirm_push" =~ ^[Yy]$ ]]; then
        if git push -u origin "$branch_name"; then
            echo "Pushed branch: $branch_name"
        else
            echo "Push failed. You can retry with option 4 later."
        fi
    else
        echo "Skipped push. Branch is local only: $branch_name"
    fi
}

# Function to undo last commit
undo_last_commit() {
    echo "--- Undo Last Commit ---"
    echo "Warning: This will undo the last commit and move changes back to staging area!"
    echo "The commit will be removed but your changes will be preserved."
    echo
    echo "Last commit details:"
    git log -1 --oneline
    echo
    read -p "Are you sure you want to undo the last commit? (y/n): " confirm
    if [[ "$confirm" =~ ^[Yy]$ ]]; then
        git reset --soft HEAD~1
        echo "Last commit has been undone. Changes are now in staging area."
        echo "You can modify and commit again if needed."
    else
        echo "Operation cancelled."
    fi
}

# Main menu loop
main() {
    while true; do
        show_menu
        read -p "Please select an option [0-17, 99]: " choice
        
        case $choice in
            0) init_repo ;;
            1) show_status ;;
            2) add_changes ;;
            3) commit_changes ;;
            4) push_to_remote ;;
            5) pull_from_remote ;;
            6) show_log ;;
            7) remove_file ;;
            8) show_commit ;;
            9) remove_file_github ;;
            10) view_branches ;;
            11) checkout_remote ;;
            12) switch_branch ;;
            13) view_tags ;;
            14) discard_changes ;;
            15) remove_cached_force ;;
            16) create_branch_commit ;;
            17) undo_last_commit ;;
            99)
                echo "Exiting Git Menu. Goodbye!"
                exit 0
                ;;
            *) 
                echo "Invalid option. Please try again."
                ;;
        esac
        
        echo
        read -p "Press Enter to continue..."
        clear
    done
}

# Run the main function
main
