pipeline {
  agent { label 'pi4' }

  environment {
    REGISTRY = "localhost" // using local registry on agent; images used only on same host
    APP_NAME = "ever-life-vault"
    DOCKER_BUILDKIT = '1'
    DEPLOY_DIR = "${env.DEPLOY_BASE_DIR ?: '/home/raulshma/apps'}/ever-life-vault"
    // Use Secret Text credential id 'github-pat' for private repo access
    GITHUB_PAT = credentials('github-pat')
    DISCORD_WEBHOOK_URL = credentials('DISCORD_WEBHOOK_URL')
  }

  parameters {
    string(name: 'WEB_PORT', defaultValue: '8080', description: 'Host port to expose the web UI (avoid 80 due to AdGuard).')
    string(name: 'BACKEND_PORT', defaultValue: '8787', description: 'Host port to expose the backend API.')
    booleanParam(name: 'REVERT_TO_LAST_BUILD', defaultValue: false, description: 'Revert to the last successful build instead of deploying new version.')
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    retry(2)
    buildDiscarder(logRotator(numToKeepStr: '10'))
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          // Ensure we're working in /home/jenkins and workspace directory exists
          sh '''
            echo "Current user: $(whoami)"
            echo "Current directory: $(pwd)"
            echo "Home directory: $HOME"
            
            # Ensure we're working from /home/jenkins
            cd /home/jenkins
            
            # Set workspace to /home/jenkins/workspace if not already set (POSIX shell)
            case "${WORKSPACE}" in
              /home/jenkins*) ;;
              *) export WORKSPACE="/home/jenkins/workspace/$(basename ${JOB_NAME})" ;;
            esac
            
            echo "Workspace: ${WORKSPACE}"
            echo "Checking workspace permissions..."
            ls -la $(dirname ${WORKSPACE}) || true
            mkdir -p ${WORKSPACE} || {
              echo "Failed to create workspace directory. Checking permissions..."
              ls -la $(dirname ${WORKSPACE})
              exit 1
            }
            ls -la ${WORKSPACE}
          '''
          
          // Build an HTTPS URL with embedded token when available
          def rawUrl = env.GIT_URL ?: 'https://github.com/raulshma/ever-life-vault.git'
          def toHttps = { String url ->
            if (url?.startsWith('git@github.com:')) {
              return url.replace('git@github.com:', 'https://github.com/')
            }
            return url
          }
          def httpsUrl = toHttps(rawUrl)
          def repoUrl = httpsUrl
          def patRaw = env.GITHUB_PAT?.trim()
          if (patRaw) {
            // Support both formats: 'token' and 'username:token'
            def username = 'git'
            def tokenOnly = patRaw
            if (patRaw.contains(':')) {
              def parts = patRaw.split(':', 2)
              if (parts[0]) { username = parts[0] }
              tokenOnly = parts.length > 1 ? parts[1] : ''
            }
            repoUrl = httpsUrl.replace('https://', "https://${username}:${tokenOnly}@")
          }

          checkout([
            $class: 'GitSCM',
            branches: [[name: '*/main']],
            doGenerateSubmoduleConfigurations: false,
            extensions: [
              [$class: 'CloneOption', shallow: true, depth: 2, noTags: false, reference: '']
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[
              url: repoUrl
            ]]
          ])
        }
      }
    }

    stage('Revert Check') {
      when {
        expression { params.REVERT_TO_LAST_BUILD == true }
      }
      steps {
        script {
          echo "Revert mode enabled - will revert to last successful build"
          
          // Find the last successful build
          def lastSuccessfulBuild = currentBuild.getPreviousSuccessfulBuild()
          if (lastSuccessfulBuild) {
            echo "Last successful build: #${lastSuccessfulBuild.number}"
            env.LAST_SUCCESSFUL_BUILD = lastSuccessfulBuild.number.toString()
          } else {
            error "No previous successful build found to revert to"
          }
        }
      }
    }

    stage('Build images') {
      when {
        expression { params.REVERT_TO_LAST_BUILD == false }
      }
      steps {
        script {
          // Clean up old images to save space
          sh 'docker image prune -f --filter "dangling=true"'
          
          // Build images with error handling from workspace root
          def turnstileSiteKey = ''
          try {
            withCredentials([string(credentialsId: 'turnstile-site-key', variable: 'TS_SITE_KEY')]) {
              turnstileSiteKey = env.TS_SITE_KEY ?: ''
            }
          } catch (Exception e) {
            echo "Warning: Credential 'turnstile-site-key' not found, proceeding without it"
          }

          sh '''
            set -e
            echo "Preparing buildx and cache directories..."

            # Directories on the agent to persist cache between builds
            CACHE_BASE="/home/jenkins/.cache/ever-life-vault"
            PNPM_STORE_DIR="${CACHE_BASE}/pnpm-store"
            LAYERS_CACHE_DIR="${CACHE_BASE}/docker-cache"
            mkdir -p "${PNPM_STORE_DIR}" "${LAYERS_CACHE_DIR}"

            # Ensure buildx builder exists
            if ! docker buildx version >/dev/null 2>&1; then
              echo "docker buildx not available; attempting to create builder..."
              docker buildx create --use --name jenkins-builder || true
            fi

            # Use buildx with local cache export/import so subsequent builds reuse pnpm and layer caches
            echo "Building backend image with buildx and cache..."
            if docker buildx version >/dev/null 2>&1; then
              docker buildx build \
                --builder jenkins-builder \
                --cache-from type=local,src="${LAYERS_CACHE_DIR}" \
                --cache-to type=local,dest="${LAYERS_CACHE_DIR}" --load \
                -t ${APP_NAME}/backend:latest -f server/Dockerfile server
            else
              docker build -t ${APP_NAME}/backend:latest -f server/Dockerfile server
            fi

            echo "Building web image with buildx and cache (pnpm store) ..."
            if docker buildx version >/dev/null 2>&1; then
              docker buildx build \
                --builder jenkins-builder \
                --cache-from type=local,src="${LAYERS_CACHE_DIR}" \
                --cache-to type=local,dest="${LAYERS_CACHE_DIR}" --load \
                --build-arg VITE_TURNSTILE_SITE_KEY=${turnstileSiteKey} \
                -t ${APP_NAME}/web:latest -f Dockerfile .
            else
              # When not using buildx, at least mount pnpm store from host into build context by using --build-arg
              docker build \
                --build-arg VITE_TURNSTILE_SITE_KEY=${turnstileSiteKey} \
                -t ${APP_NAME}/web:latest -f Dockerfile .
            fi

            echo "Images built successfully"
            docker images | grep ${APP_NAME} || true
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        script {
          if (params.REVERT_TO_LAST_BUILD) {
            // Revert mode - restore from last successful build
            echo "Reverting to last successful build #${env.LAST_SUCCESSFUL_BUILD}"
            
            // Copy deployment files from last successful build
            sh """
              cp -r /home/jenkins/workspace/${env.JOB_NAME}/builds/${env.LAST_SUCCESSFUL_BUILD}/archive/deploy/* ${DEPLOY_DIR}/
              echo "Restored deployment files from build #${env.LAST_SUCCESSFUL_BUILD}"
            """
            
            // Run deployment script in revert mode
            sh """
              chmod +x ${DEPLOY_DIR}/deploy.sh
              export DEPLOY_DIR=${DEPLOY_DIR}
              export APP_NAME=${APP_NAME}
              export WEB_PORT=${WEB_PORT}
              export BACKEND_PORT=${BACKEND_PORT}
              export REVERT_MODE=true
              ${DEPLOY_DIR}/deploy.sh
            """
          } else {
            // Normal deployment mode
            // Helper: safely resolve a Jenkins Secret Text credential
            def readSecret = { credId ->
              def value = ''
              try {
                withCredentials([string(credentialsId: credId, variable: 'CVAL')]) {
                  value = env.CVAL
                }
              } catch (Exception e) {
                echo "Warning: Credential '${credId}' not found, using empty value"
              }
              return value
            }
            
            // Load credentials using bindings (each one optional)
            def supabaseUrl = readSecret('supabase-url')
            def supabaseAnonKey = readSecret('supabase-anon-key')
            def supabaseServiceRoleKey = readSecret('supabase-service-role-key')
            def redditClientId = readSecret('reddit-client-id')
            def redditClientSecret = readSecret('reddit-client-secret')
            def redditRedirectUri = readSecret('reddit-redirect-uri')
            def googleClientId = readSecret('google-client-id')
            def googleClientSecret = readSecret('google-client-secret')
            def googleRedirectUri = readSecret('google-redirect-uri')
            // Load optional Google API key (for e.g. Vision / Maps / Geocoding usage)
            def googleApiKey = readSecret('google-api-key')
            // Make the key available in the pipeline environment for later steps
            env.GOOGLE_API_KEY = googleApiKey
            if (!googleApiKey?.trim()) {
              echo "Warning: Google API key not provided (credential id: 'google-api-key'). Features depending on GOOGLE_API_KEY will be disabled."
            } else {
              echo "Google API key loaded into pipeline environment (partial): ${googleApiKey.substring(0, Math.min(googleApiKey.length(), 8))}..."
            }
            def msClientId = readSecret('ms-client-id')
            def msClientSecret = readSecret('ms-client-secret')
            def msRedirectUri = readSecret('ms-redirect-uri')
            def ytClientId = readSecret('yt-client-id')
            def ytClientSecret = readSecret('yt-client-secret')
            def ytRedirectUri = readSecret('yt-redirect-uri')
            def ytmClientId = readSecret('ytm-client-id')
            def ytmClientSecret = readSecret('ytm-client-secret')
            def ytmRedirectUri = readSecret('ytm-redirect-uri')
            def spotifyClientId = readSecret('spotify-client-id')
            def spotifyClientSecret = readSecret('spotify-client-secret')
            def spotifyRedirectUri = readSecret('spotify-redirect-uri')
            def steamWebApiKey = readSecret('steam-web-api-key')
            def malClientId = readSecret('mal-client-id')
            def malClientSecret = readSecret('mal-client-secret')
            def malRedirectUri = readSecret('mal-redirect-uri')
            def malTokensSecret = readSecret('mal-tokens-secret')

            // Load OpenRouter credentials
            def openRouterApiKey = readSecret('openrouter-api-key')
            // Make the key available in the pipeline environment so later steps can reference it
            env.OPENROUTER_API_KEY = openRouterApiKey
            if (!openRouterApiKey?.trim()) {
              echo "Warning: OpenRouter API key not provided (credential id: 'openrouter-api-key'). LLM routes may be registered without OpenRouter integration."
            } else {
              echo "OpenRouter API key loaded into pipeline environment (partial): ${openRouterApiKey.substring(0, Math.min(openRouterApiKey.length(), 8))}..."
            }

            // Load Turnstile credentials
            def turnstileSiteKey = readSecret('turnstile-site-key')
            def turnstileSecretKey = readSecret('turnstile-secret-key')
            
            // Auto-fill PUBLIC_BASE_URL and ALLOWED_ORIGINS if not provided
            if (!env.PUBLIC_BASE_URL?.trim()) {
              env.PUBLIC_BASE_URL = "http://192.168.1.169:${env.WEB_PORT ?: '8080'}"
            }
            if (!env.ALLOWED_ORIGINS?.trim()) {
              env.ALLOWED_ORIGINS = env.PUBLIC_BASE_URL
            }
            
            // Ensure deployment directory exists on agent
            sh "mkdir -p ${DEPLOY_DIR}"
            // Copy compose and config into place
            sh "cp -r deploy/* ${DEPLOY_DIR}/"

            // Write .env from Jenkins credentials/params if provided
            writeFile file: "${DEPLOY_DIR}/.env", text: """WEB_PORT=${WEB_PORT}
BACKEND_PORT=${BACKEND_PORT}
PUBLIC_BASE_URL=${env.PUBLIC_BASE_URL}
ALLOWED_ORIGINS=${env.ALLOWED_ORIGINS}
ALLOWED_TARGET_HOSTS=${env.ALLOWED_TARGET_HOSTS ?: 'backend,localhost,127.0.0.1'}
OAUTH_REDIRECT_BASE_URL=${env.PUBLIC_BASE_URL}
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceRoleKey}
REDDIT_CLIENT_ID=${redditClientId}
REDDIT_CLIENT_SECRET=${redditClientSecret}
REDDIT_REDIRECT_URI=${redditRedirectUri}
GOOGLE_API_KEY=${googleApiKey}
GOOGLE_CLIENT_ID=${googleClientId}
GOOGLE_CLIENT_SECRET=${googleClientSecret}
GOOGLE_REDIRECT_URI=${googleRedirectUri}
MS_CLIENT_ID=${msClientId}
MS_CLIENT_SECRET=${msClientSecret}
MS_REDIRECT_URI=${msRedirectUri}
YT_CLIENT_ID=${ytClientId}
YT_CLIENT_SECRET=${ytClientSecret}
YT_REDIRECT_URI=${ytRedirectUri}
YTM_CLIENT_ID=${ytmClientId}
YTM_CLIENT_SECRET=${ytmClientSecret}
YTM_REDIRECT_URI=${ytmRedirectUri}
SPOTIFY_CLIENT_ID=${spotifyClientId}
SPOTIFY_CLIENT_SECRET=${spotifyClientSecret}
SPOTIFY_REDIRECT_URI=${spotifyRedirectUri}
STEAM_WEB_API_KEY=${steamWebApiKey}
MAL_CLIENT_ID=${malClientId}
MAL_CLIENT_SECRET=${malClientSecret}
MAL_REDIRECT_URI=${malRedirectUri}
MAL_TOKENS_SECRET=${malTokensSecret}
OPENROUTER_API_KEY=${openRouterApiKey}
# Cloudflare Turnstile Configuration
TURNSTILE_SITE_KEY=${turnstileSiteKey}
TURNSTILE_SECRET_KEY=${turnstileSecretKey}
VITE_TURNSTILE_SITE_KEY=${turnstileSiteKey}
"""

            // Make deployment script executable and run it
            sh """
              chmod +x ${DEPLOY_DIR}/deploy.sh
              export DEPLOY_DIR=${DEPLOY_DIR}
              export APP_NAME=${APP_NAME}
              export WEB_PORT=${WEB_PORT}
              export BACKEND_PORT=${BACKEND_PORT}
              ${DEPLOY_DIR}/deploy.sh
            """
          }
        }
      }
    }
  }

  post {
    failure {
      script {
        echo 'Deployment failed.'
        // Send Discord notification on failure if webhook is configured
        try {
          def hook = env.DISCORD_WEBHOOK_URL?.trim()
          if (hook) {
            // Collect git and runtime metadata where possible to include in notifications
            def commitShort = ''
            def commitFull = ''
            def branch = ''
            def author = ''
            def commitMsg = ''
            def remoteUrl = ''
            def commitUrl = ''
            def duration = currentBuild.durationString ?: 'N/A'
            def nodeName = env.NODE_NAME ?: 'N/A'
            def paramSummary = ''
            def changedFiles = ''
            def imagesInfo = ''
            def deployTarget = env.DEPLOY_DIR ?: 'N/A'
            def publicUrl = env.PUBLIC_BASE_URL ?: 'N/A'
            def triggeredBy = 'N/A'
            def ws = env.WORKSPACE ?: '.'

            // Ensure these exist even if git info collection fails
            def changedCount = 0
            def changedPreview = 'N/A'
            try {
              // Git info - use WORKSPACE directory or find the git root
              def gitDir = ws
              echo "Initial workspace directory: ${ws}"
              echo "Current working directory: ${sh(returnStdout: true, script: 'pwd').trim()}"
              
              // Check if current workspace is a git repo, if not try to find the git root
              def gitRootCheck = sh(returnStdout: true, script: "cd '${ws}' && git rev-parse --show-toplevel 2>/dev/null || echo 'NOTGIT'").trim()
              if (gitRootCheck == 'NOTGIT') {
                echo "Workspace ${ws} is not a git repository, searching for git directories..."
                
                // Try to find git repository in the workspace - fix the xargs issue
                def findGitOutput = sh(returnStdout: true, script: "find '${ws}' -name '.git' -type d 2>/dev/null || true").trim()
                if (findGitOutput && !findGitOutput.isEmpty()) {
                  // Get the parent directory of the .git folder
                  gitDir = sh(returnStdout: true, script: "dirname '${findGitOutput.split('\n')[0]}'").trim()
                  echo "Found git repository at: ${gitDir}"
                } else {
                  echo "No .git directory found in ${ws}, trying current working directory..."
                  // Try current working directory
                  def cwdGitCheck = sh(returnStdout: true, script: "git rev-parse --show-toplevel 2>/dev/null || echo 'NOTGIT'").trim()
                  if (cwdGitCheck != 'NOTGIT') {
                    gitDir = cwdGitCheck
                    echo "Found git repository in current working directory: ${gitDir}"
                  } else {
                    echo "Warning: No git repository found in workspace ${ws} or current directory"
                    // Try to use the checkout directory from earlier stages
                    // The checkout stage should have created the repository somewhere
                    def possibleDirs = [
                      "${ws}",
                      "/home/jenkins/workspace/${env.JOB_NAME}",
                      "/home/jenkins/workspace/${env.JOB_BASE_NAME}",
                      env.WORKSPACE
                    ].findAll { it != null && !it.isEmpty() }.unique()
                    
                    for (dir in possibleDirs) {
                      def checkDir = sh(returnStdout: true, script: "if [ -d '${dir}/.git' ]; then echo '${dir}'; fi || true").trim()
                      if (checkDir && !checkDir.isEmpty()) {
                        gitDir = checkDir
                        echo "Found git repository at alternative location: ${gitDir}"
                        break
                      }
                    }
                    
                    if (!gitDir || gitDir == ws) {
                      echo "Still no git repository found, will use fallback with no git info"
                      gitDir = null
                    }
                  }
                }
              } else {
                gitDir = gitRootCheck
                echo "Using git repository at: ${gitDir}"
              }
              
              if (gitDir) {
                commitShort = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse --short HEAD || true").trim()
                commitFull = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse HEAD || true").trim()
                branch = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse --abbrev-ref HEAD || true").trim()
                author = sh(returnStdout: true, script: "git -C '${gitDir}' log -1 --pretty=format:'%an <%ae>' || true").trim()
                commitMsg = sh(returnStdout: true, script: "git -C '${gitDir}' log -1 --pretty=format:%s || true").trim()
                remoteUrl = sh(returnStdout: true, script: "git -C '${gitDir}' config --get remote.origin.url || true").trim()
              } else {
                echo "No git repository available, trying Jenkins environment variables as fallback"
                // Try to use Jenkins environment variables as fallback
                commitShort = env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'unknown'
                commitFull = env.GIT_COMMIT ?: 'unknown'
                branch = env.GIT_BRANCH ?: env.BRANCH_NAME ?: 'unknown'
                author = env.CHANGE_AUTHOR ?: env.BUILD_USER_EMAIL ?: 'unknown'
                commitMsg = env.CHANGE_TITLE ?: 'No commit message available'
                remoteUrl = env.GIT_URL ?: ''
              }
              if (remoteUrl) {
                // Strip any embedded credentials to avoid leaking tokens in notifications
                try {
                  remoteUrl = remoteUrl.replaceFirst('https?://[^@]+@', 'https://')
                } catch (ignore) { }
                if (remoteUrl.startsWith('git@')) {
                  remoteUrl = remoteUrl.replaceFirst('git@github.com:', 'https://github.com/')
                }
                if (remoteUrl.endsWith('.git')) {
                  remoteUrl = remoteUrl[0..-5]
                }
                if (commitFull) {
                  commitUrl = "${remoteUrl}/commit/${commitFull}"
                }
              }

              // Changed files in the last commit (full list may be long)
              if (gitDir) {
                changedFiles = sh(returnStdout: true, script: "git -C '${gitDir}' show --name-only --pretty=\"\" HEAD || true").trim()
              }
              // Truncate preview to avoid overly large notifications
              def changedList = changedFiles ? changedFiles.readLines().collect{ it.trim() }.findAll{ it } : []
              changedCount = changedList.size()
              def maxPreview = 10
              // changedPreview already initialized above
              if (changedCount > 0) {
                def previewList = changedList.take(maxPreview)
                changedPreview = previewList.join('\n')
                if (changedCount > maxPreview) {
                  changedPreview += "\n... and ${changedCount - maxPreview} more files"
                }
              }

              // Who triggered the build (prefer env vars provided by common plugins to avoid Script Security approvals)
              // Common env vars provided by build-user-vars-plugin or multibranch/PR plugins
              triggeredBy = env.BUILD_USER ?: env.BUILD_USER_ID ?: env.BUILD_USER_EMAIL ?: env.CHANGE_AUTHOR ?: env.ghprbTriggerAuthor ?: env.ghprbCommentAuthor ?: triggeredBy

              // Parameters summary
              try {
                paramSummary = params.collect { k, v -> "${k}=${v}" }.join(', ')
              } catch (p) {
                paramSummary = 'N/A'
              }

              // Docker image info (if docker available on agent)
              try {
                imagesInfo = sh(returnStdout: true, script: "docker images --filter reference='${env.APP_NAME}/*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' || true").trim()
              } catch (di) {
                imagesInfo = 'N/A'
              }
            } catch (e) {
              echo "Could not collect extended build info: ${e}"
            }

            def title = "${env.APP_NAME} build #${env.BUILD_NUMBER} FAILED (${commitShort ?: 'unknown'})"
            def desc = """Job: ${env.JOB_NAME}
URL: ${env.BUILD_URL}
Mode: ${params.REVERT_TO_LAST_BUILD ? 'Revert' : 'Deploy'}
Branch: ${branch ?: 'N/A'}
Commit: ${commitShort ?: 'N/A'}
Author: ${author ?: 'N/A'}
Message: ${commitMsg ?: 'N/A'}
Commit URL: ${commitUrl ?: 'N/A'}
Duration: ${duration}
Agent: ${nodeName}
Triggered by: ${triggeredBy}
Params: ${paramSummary ?: 'N/A'}
Deploy target: ${deployTarget}
Public URL: ${publicUrl}
Images:
${imagesInfo ?: 'N/A'}
 Changed files (${changedCount}):
${changedPreview}
"""

            discordSend webhookURL: hook,
              title: title,
              description: desc,
              link: env.BUILD_URL,
              result: 'FAILURE'
          } else {
            echo 'DISCORD_WEBHOOK_URL not set; skipping Discord failure notification.'
          }
        } catch (err) {
          echo "Discord notification failed: ${err}"
        }
        
        // Offer automatic rollback option
        if (!params.REVERT_TO_LAST_BUILD) {
          echo 'Consider running the build again with REVERT_TO_LAST_BUILD=true to rollback to the previous version.'
          
          // Check if we have a previous successful build
          def lastSuccessfulBuild = currentBuild.getPreviousSuccessfulBuild()
          if (lastSuccessfulBuild) {
            echo "Previous successful build available: #${lastSuccessfulBuild.number}"
            echo "To revert, run: build(job: '${env.JOB_NAME}', parameters: [booleanParam(name: 'REVERT_TO_LAST_BUILD', value: true)])"
          }
        }
      }
    }
    success {
      script {
        if (params.REVERT_TO_LAST_BUILD) {
          echo 'Revert to last build completed successfully.'
        } else {
          echo 'Deployment succeeded.'
        }

        // Send Discord notification on success if webhook is configured
        try {
          def hook = env.DISCORD_WEBHOOK_URL?.trim()
          if (hook) {
            // Collect git and runtime metadata where possible to include in notifications
            def commitShort = ''
            def commitFull = ''
            def branch = ''
            def author = ''
            def commitMsg = ''
            def remoteUrl = ''
            def commitUrl = ''
            def duration = currentBuild.durationString ?: 'N/A'
            def nodeName = env.NODE_NAME ?: 'N/A'
            def paramSummary = ''
            def changedFiles = ''
            def imagesInfo = ''
            def deployTarget = env.DEPLOY_DIR ?: 'N/A'
            def publicUrl = env.PUBLIC_BASE_URL ?: 'N/A'
            def triggeredBy = 'N/A'
            def ws = env.WORKSPACE ?: '.'

            // Ensure these exist even if git info collection fails
            def changedCount = 0
            def changedPreview = 'N/A'
            try {
              // Git info - use WORKSPACE directory or find the git root
              def gitDir = ws
              echo "Initial workspace directory: ${ws}"
              echo "Current working directory: ${sh(returnStdout: true, script: 'pwd').trim()}"
              
              // Check if current workspace is a git repo, if not try to find the git root
              def gitRootCheck = sh(returnStdout: true, script: "cd '${ws}' && git rev-parse --show-toplevel 2>/dev/null || echo 'NOTGIT'").trim()
              if (gitRootCheck == 'NOTGIT') {
                echo "Workspace ${ws} is not a git repository, searching for git directories..."
                
                // Try to find git repository in the workspace - fix the xargs issue
                def findGitOutput = sh(returnStdout: true, script: "find '${ws}' -name '.git' -type d 2>/dev/null || true").trim()
                if (findGitOutput && !findGitOutput.isEmpty()) {
                  // Get the parent directory of the .git folder
                  gitDir = sh(returnStdout: true, script: "dirname '${findGitOutput.split('\n')[0]}'").trim()
                  echo "Found git repository at: ${gitDir}"
                } else {
                  echo "No .git directory found in ${ws}, trying current working directory..."
                  // Try current working directory
                  def cwdGitCheck = sh(returnStdout: true, script: "git rev-parse --show-toplevel 2>/dev/null || echo 'NOTGIT'").trim()
                  if (cwdGitCheck != 'NOTGIT') {
                    gitDir = cwdGitCheck
                    echo "Found git repository in current working directory: ${gitDir}"
                  } else {
                    echo "Warning: No git repository found in workspace ${ws} or current directory"
                    // Try to use the checkout directory from earlier stages
                    // The checkout stage should have created the repository somewhere
                    def possibleDirs = [
                      "${ws}",
                      "/home/jenkins/workspace/${env.JOB_NAME}",
                      "/home/jenkins/workspace/${env.JOB_BASE_NAME}",
                      env.WORKSPACE
                    ].findAll { it != null && !it.isEmpty() }.unique()
                    
                    for (dir in possibleDirs) {
                      def checkDir = sh(returnStdout: true, script: "if [ -d '${dir}/.git' ]; then echo '${dir}'; fi || true").trim()
                      if (checkDir && !checkDir.isEmpty()) {
                        gitDir = checkDir
                        echo "Found git repository at alternative location: ${gitDir}"
                        break
                      }
                    }
                    
                    if (!gitDir || gitDir == ws) {
                      echo "Still no git repository found, will use fallback with no git info"
                      gitDir = null
                    }
                  }
                }
              } else {
                gitDir = gitRootCheck
                echo "Using git repository at: ${gitDir}"
              }
              
              if (gitDir) {
                commitShort = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse --short HEAD || true").trim()
                commitFull = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse HEAD || true").trim()
                branch = sh(returnStdout: true, script: "git -C '${gitDir}' rev-parse --abbrev-ref HEAD || true").trim()
                author = sh(returnStdout: true, script: "git -C '${gitDir}' log -1 --pretty=format:'%an <%ae>' || true").trim()
                commitMsg = sh(returnStdout: true, script: "git -C '${gitDir}' log -1 --pretty=format:%s || true").trim()
                remoteUrl = sh(returnStdout: true, script: "git -C '${gitDir}' config --get remote.origin.url || true").trim()
              } else {
                echo "No git repository available, trying Jenkins environment variables as fallback"
                // Try to use Jenkins environment variables as fallback
                commitShort = env.GIT_COMMIT ? env.GIT_COMMIT.take(7) : 'unknown'
                commitFull = env.GIT_COMMIT ?: 'unknown'
                branch = env.GIT_BRANCH ?: env.BRANCH_NAME ?: 'unknown'
                author = env.CHANGE_AUTHOR ?: env.BUILD_USER_EMAIL ?: 'unknown'
                commitMsg = env.CHANGE_TITLE ?: 'No commit message available'
                remoteUrl = env.GIT_URL ?: ''
              }
              if (remoteUrl) {
                // Strip any embedded credentials to avoid leaking tokens in notifications
                try {
                  remoteUrl = remoteUrl.replaceFirst('https?://[^@]+@', 'https://')
                } catch (ignore) { }
                if (remoteUrl.startsWith('git@')) {
                  remoteUrl = remoteUrl.replaceFirst('git@github.com:', 'https://github.com/')
                }
                if (remoteUrl.endsWith('.git')) {
                  remoteUrl = remoteUrl[0..-5]
                }
                if (commitFull) {
                  commitUrl = "${remoteUrl}/commit/${commitFull}"
                }
              }

              // Changed files in the last commit (full list may be long)
              if (gitDir) {
                changedFiles = sh(returnStdout: true, script: "git -C '${gitDir}' show --name-only --pretty=\"\" HEAD || true").trim()
              }
              // Truncate preview to avoid overly large notifications
              def changedList = changedFiles ? changedFiles.readLines().collect{ it.trim() }.findAll{ it } : []
              changedCount = changedList.size()
              def maxPreview = 10
              // changedPreview already initialized above
              if (changedCount > 0) {
                def previewList = changedList.take(maxPreview)
                changedPreview = previewList.join('\n')
                if (changedCount > maxPreview) {
                  changedPreview += "\n... and ${changedCount - maxPreview} more files"
                }
              }

              // Who triggered the build (prefer env vars provided by common plugins to avoid Script Security approvals)
              // Common env vars provided by build-user-vars-plugin or multibranch/PR plugins
              triggeredBy = env.BUILD_USER ?: env.BUILD_USER_ID ?: env.BUILD_USER_EMAIL ?: env.CHANGE_AUTHOR ?: env.ghprbTriggerAuthor ?: env.ghprbCommentAuthor ?: triggeredBy

              // Parameters summary
              try {
                paramSummary = params.collect { k, v -> "${k}=${v}" }.join(', ')
              } catch (p) {
                paramSummary = 'N/A'
              }

              // Docker image info (if docker available on agent)
              try {
                imagesInfo = sh(returnStdout: true, script: "docker images --filter reference='${env.APP_NAME}/*' --format '{{.Repository}}:{{.Tag}} {{.ID}} {{.Size}}' || true").trim()
              } catch (di) {
                imagesInfo = 'N/A'
              }
            } catch (e) {
              echo "Could not collect extended build info: ${e}"
            }

            def title = "${env.APP_NAME} build #${env.BUILD_NUMBER} SUCCESS (${commitShort ?: 'unknown'})"
            def mode = params.REVERT_TO_LAST_BUILD ? "Reverted to build #${env.LAST_SUCCESSFUL_BUILD ?: 'N/A'}" : 'Deployment completed'
            def desc = """Job: ${env.JOB_NAME}
URL: ${env.BUILD_URL}
${mode}
Branch: ${branch ?: 'N/A'}
Commit: ${commitShort ?: 'N/A'}
Author: ${author ?: 'N/A'}
Message: ${commitMsg ?: 'N/A'}
Commit URL: ${commitUrl ?: 'N/A'}
Duration: ${duration}
Agent: ${nodeName}
Triggered by: ${triggeredBy}
Params: ${paramSummary ?: 'N/A'}
Deploy target: ${deployTarget}
Public URL: ${publicUrl}
Images:
${imagesInfo ?: 'N/A'}
Changed files (${changedCount}):
${changedPreview}
"""

            discordSend webhookURL: hook,
              title: title,
              description: desc,
              link: env.BUILD_URL,
              result: 'SUCCESS'
          } else {
            echo 'DISCORD_WEBHOOK_URL not set; skipping Discord success notification.'
          }
        } catch (err) {
          echo "Discord notification failed: ${err}"
        }
      }
    }
    always {
      // Archive deployment files for potential rollback
      archiveArtifacts artifacts: 'deploy/**/*', fingerprint: true
      
      // Clean up workspace
      cleanWs()
    }
  }
}


