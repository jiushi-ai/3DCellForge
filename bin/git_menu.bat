@echo off
:menu
echo ===============================
echo        Git Menu
echo ===============================
echo 0. Init Repo    1. Status    2. Add    3. Commit    4. Push    5. Pull
echo 6. Log       7. Remove file    8. Show commit    9. Remove file from GitHub    10. View Branches
echo 11. Checkout Remote Branch    12. Switch Branch    13. View Tags    14. Discard Changes
echo 15. Force unstage (git rm --cached -f)    16. Create Branch + Commit    17. Undo Last Commit
echo 99. Exit
echo.
set /p choice="Please select an option [0-17, 99]: "

if "%choice%"=="0" goto init_repo
if "%choice%"=="1" goto status
if "%choice%"=="2" goto add
if "%choice%"=="3" goto commit
if "%choice%"=="4" goto push
if "%choice%"=="5" goto pull
if "%choice%"=="6" goto log
if "%choice%"=="7" goto rm_file
if "%choice%"=="8" goto show_commit
if "%choice%"=="9" goto rm_file_github
if "%choice%"=="10" goto view_branches
if "%choice%"=="11" goto checkout_remote
if "%choice%"=="12" goto switch_branch
if "%choice%"=="13" goto view_tags
if "%choice%"=="14" goto discard_changes
if "%choice%"=="15" goto rm_cached_force
if "%choice%"=="16" goto create_branch_commit
if "%choice%"=="17" goto undo_last_commit
if "%choice%"=="99" goto end
echo Invalid option. Please try again.
goto menu

:init_repo
echo --- Initialize Git Repository ---
git rev-parse --is-inside-work-tree >nul 2>nul
if %errorlevel%==0 (
    echo Current directory is already a Git repository!
    goto menu
)
git init
echo Repository initialized.
set /p remoteurl="Enter GitHub repository URL (e.g., https://github.com/xxx/yyy.git): "
if "%remoteurl%"=="" (
    echo Repository URL cannot be empty!
    goto menu
)
git add .
echo Files added.
set /p firstmsg="Enter first commit message: "
if "%firstmsg%"=="" (
    set firstmsg=first commit
)
git commit -m "%firstmsg%"
git branch -M main
git remote add origin "%remoteurl%"
echo Pushing to remote repository...
git push -u origin main
echo Initialization and push completed.
goto menu

:status
echo --- Git Status ---
git status
goto menu

:add
echo --- Add All Changes ---
git add .
echo All changes have been added.
goto menu

:commit
echo --- Commit Changes ---
set /p msg="Enter commit message: "
if "%msg%"=="" (
    echo Commit message cannot be empty!
    goto menu
)
git commit -m "%msg%"
goto menu

:push
echo --- Push to Remote ---
git push
goto menu

:pull
echo --- Pull from Remote ---
git pull
goto menu

:log
echo --- Git Log (last 5 commits) ---
git log -5 --oneline
goto menu

:rm_file
echo --- Remove tracked file from git index ---
set /p rmfile="Enter the file name to remove from git index: "
if "%rmfile%"=="" (
    echo File name cannot be empty!
    goto menu
)
git rm --cached "%rmfile%"
goto menu

:show_commit
echo --- Last Commit Details (git show) ---
echo (Tip: Press q to quit and return to menu)
git show
goto menu

:rm_file_github
echo --- Remove file from GitHub (local+remote) ---
set /p rmfile2="Enter the file name to remove from GitHub: "
if "%rmfile2%"=="" (
    echo File name cannot be empty!
    goto menu
)
git rm "%rmfile2%"
echo File removed locally. Now committing...
set /p msg2="Enter commit message for file removal: "
if "%msg2%"=="" (
    set msg2=remove file %rmfile2%
)
git commit -m "%msg2%"
echo Pushing to remote...
git push
echo File %rmfile2% has been removed from local and remote repository.
goto menu

:view_branches
echo --- View Branches ---
echo Local branches:
git branch
echo.
echo Remote branches:
git branch -r
echo.
echo All branches:
git branch -a
goto menu

:checkout_remote
echo --- Checkout Remote Branch ---
echo Fetching remote branches...
git fetch origin
echo.
echo Remote branches:
git branch -r
echo.
echo Tip: Enter branch name only, e.g. perf/p0-dtw-band-resample-numpy
echo      (no need to include "origin/" prefix)
echo.
set /p remote_branch="Enter remote branch name: "
if "%remote_branch%"=="" (
    echo Branch name cannot be empty!
    goto menu
)
rem 自动去掉用户误输入的 "origin/" 前缀
set remote_branch=%remote_branch:origin/=%
git checkout -b "%remote_branch%" "origin/%remote_branch%"
if %errorlevel%==0 (
    echo Successfully checked out remote branch: %remote_branch%
) else (
    echo Failed. Branch may already exist locally. Try option 12 to switch to it.
)
goto menu

:switch_branch
echo --- Switch Branch ---
echo Current branch:
git branch --show-current
echo.
echo Available branches:
git branch
echo.
set /p branch_name="Enter branch name to switch to: "
if "%branch_name%"=="" (
    echo Branch name cannot be empty!
    goto menu
)
git checkout "%branch_name%"
if %errorlevel%==0 (
    echo Successfully switched to branch: %branch_name%
) else (
    echo Failed to switch branch, please check if the branch name is correct
)
goto menu

:view_tags
echo --- View Tags ---
echo Local tags:
git tag
echo.
echo Remote tags:
git ls-remote --tags origin
goto menu

:discard_changes
echo --- Discard Local Changes ---
echo Warning: This will discard all local changes and cannot be undone!
echo This will reset tracked files to HEAD and remove untracked files.
set /p confirm="Are you sure you want to discard all changes? (y/n): "
if /i "%confirm%"=="y" (
    git reset --hard HEAD
    git clean -fd
    echo All local changes have been discarded.
) else (
    echo Operation cancelled.
)
goto menu

:rm_cached_force
echo --- Force Remove from Staging Index (git rm --cached -f) ---
echo Tip: Use this to unstage mistakenly added paths (e.g. nested git repos).
echo      Local files will NOT be deleted.
set /p rmfile_force="Enter file or directory path to force-unstage: "
if "%rmfile_force%"=="" (
    echo Path cannot be empty!
    goto menu
)
git rm --cached -f "%rmfile_force%"
if %errorlevel%==0 (
    echo Successfully removed from staging index: %rmfile_force%
) else (
    echo Failed to remove from staging index. Check path and git status.
)
goto menu

:create_branch_commit
echo --- Create Branch + Commit Current Changes ---
echo Current branch:
git branch --show-current
echo.
echo Working tree status:
git status -sb
echo.
echo Tip: Branch name should be ASCII slug, e.g. feat/scheme2-occ-correspondence
echo      Commit message can be Chinese or English title/description.
echo.
set /p branch_name="Enter new branch name: "
if "%branch_name%"=="" (
    echo Branch name cannot be empty!
    goto menu
)
git show-ref --verify --quiet "refs/heads/%branch_name%"
if %errorlevel%==0 (
    echo Branch already exists locally: %branch_name%
    echo Use option 12 to switch, or choose a different name.
    goto menu
)
git checkout -b "%branch_name%"
if not %errorlevel%==0 (
    echo Failed to create branch: %branch_name%
    goto menu
)
echo Created and switched to branch: %branch_name%
echo.
set /p confirm_add="Stage all changes with git add . ? (y/n): "
if /i not "%confirm_add%"=="y" (
    echo Operation cancelled after creating branch. You are on: %branch_name%
    goto menu
)
git add .
echo.
set /p msg="Enter commit message: "
if "%msg%"=="" (
    set "msg=feat: %branch_name%"
)
git commit -m "%msg%"
if not %errorlevel%==0 (
    echo Commit failed. Branch exists: %branch_name%
    goto menu
)
echo Commit completed on branch: %branch_name%
echo.
set /p confirm_push="Push branch to origin with -u? (y/n): "
if /i "%confirm_push%"=="y" (
    git push -u origin "%branch_name%"
    if %errorlevel%==0 (
        echo Pushed branch: %branch_name%
    ) else (
        echo Push failed. You can retry with option 4 later.
    )
) else (
    echo Skipped push. Branch is local only: %branch_name%
)
goto menu

:undo_last_commit
echo --- Undo Last Commit ---
echo Warning: This will undo the last commit and move changes back to staging area!
echo The commit will be removed but your changes will be preserved.
echo.
echo Last commit details:
git log -1 --oneline
echo.
set /p confirm="Are you sure you want to undo the last commit? (y/n): "
if /i "%confirm%"=="y" (
    git reset --soft HEAD~1
    echo Last commit has been undone. Changes are now in staging area.
    echo You can modify and commit again if needed.
) else (
    echo Operation cancelled.
)
goto menu

:end
echo Exiting Git Menu. Goodbye!
exit /b 