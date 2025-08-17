pipeline {
  agent { label 'pi4' }

  environment {
    REGISTRY = "localhost" // using local registry on agent; images used only on same host
    APP_NAME = "ever-life-vault"
    DOCKER_BUILDKIT = '1'
    DEPLOY_DIR = "${env.DEPLOY_BASE_DIR ?: '/home/raulshma/apps'}/ever-life-vault"
  }

  parameters {
    string(name: 'WEB_PORT', defaultValue: '8080', description: 'Host port to expose the web UI (avoid 80 due to AdGuard).')
  }

  options {
    skipDefaultCheckout(true)
    timestamps()
    retry(2)
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
            
            # Set workspace to /home/jenkins/workspace if not already set
            if [[ "${WORKSPACE}" != "/home/jenkins"* ]]; then
              export WORKSPACE="/home/jenkins/workspace/$(basename ${JOB_NAME})"
            fi
            
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
          
          checkout([
            $class: 'GitSCM',
            branches: [[name: '*/jenkins']],
            doGenerateSubmoduleConfigurations: false,
            extensions: [
              [$class: 'CloneOption', shallow: true, depth: 2, noTags: false, reference: '']
            ],
            submoduleCfg: [],
            userRemoteConfigs: [[
              url: env.GIT_URL ?: 'https://github.com/raulshma/ever-life-vault.git',
              credentialsId: env.GIT_CREDENTIALS_ID ?: 'github-ssh'
            ]]
          ])
        }
      }
    }

    stage('Build images') {
      steps {
        script {
          // Clean up old images to save space
          sh 'docker image prune -f --filter "dangling=true"'
          
          // Build images with error handling from workspace root
          sh '''
            set -e
            echo "Building backend image..."
            docker build -t ${APP_NAME}/backend:latest -f server/Dockerfile server
            
            echo "Building web image..."
            docker build -t ${APP_NAME}/web:latest -f Dockerfile .
            
            echo "Images built successfully"
            docker images | grep ${APP_NAME}
          '''
        }
      }
    }

    stage('Deploy') {
      steps {
        script {
          // Helper function to safely get credentials
          def getCredentialSafely = { credId ->
            try {
              return credentials(credId)
            } catch (Exception e) {
              echo "Warning: Credential '${credId}' not found, using empty value"
              return ''
            }
          }
          
          // Load credentials safely
          def supabaseUrl = getCredentialSafely('supabase-url')
          def supabaseAnonKey = getCredentialSafely('supabase-anon-key')
          def supabaseServiceRoleKey = getCredentialSafely('supabase-service-role-key')
          def redditClientId = getCredentialSafely('reddit-client-id')
          def redditClientSecret = getCredentialSafely('reddit-client-secret')
          def redditRedirectUri = getCredentialSafely('reddit-redirect-uri')
          def googleClientId = getCredentialSafely('google-client-id')
          def googleClientSecret = getCredentialSafely('google-client-secret')
          def googleRedirectUri = getCredentialSafely('google-redirect-uri')
          def msClientId = getCredentialSafely('ms-client-id')
          def msClientSecret = getCredentialSafely('ms-client-secret')
          def msRedirectUri = getCredentialSafely('ms-redirect-uri')
          def ytClientId = getCredentialSafely('yt-client-id')
          def ytClientSecret = getCredentialSafely('yt-client-secret')
          def ytRedirectUri = getCredentialSafely('yt-redirect-uri')
          def ytmClientId = getCredentialSafely('ytm-client-id')
          def ytmClientSecret = getCredentialSafely('ytm-client-secret')
          def ytmRedirectUri = getCredentialSafely('ytm-redirect-uri')
          def spotifyClientId = getCredentialSafely('spotify-client-id')
          def spotifyClientSecret = getCredentialSafely('spotify-client-secret')
          def spotifyRedirectUri = getCredentialSafely('spotify-redirect-uri')
          def steamWebApiKey = getCredentialSafely('steam-web-api-key')
          def malClientId = getCredentialSafely('mal-client-id')
          def malClientSecret = getCredentialSafely('mal-client-secret')
          def malRedirectUri = getCredentialSafely('mal-redirect-uri')
          def malTokensSecret = getCredentialSafely('mal-tokens-secret')
          
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
PUBLIC_BASE_URL=${env.PUBLIC_BASE_URL}
ALLOWED_ORIGINS=${env.ALLOWED_ORIGINS}
SUPABASE_URL=${supabaseUrl}
SUPABASE_ANON_KEY=${supabaseAnonKey}
SUPABASE_SERVICE_ROLE_KEY=${supabaseServiceRoleKey}
REDDIT_CLIENT_ID=${redditClientId}
REDDIT_CLIENT_SECRET=${redditClientSecret}
REDDIT_REDIRECT_URI=${redditRedirectUri}
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
"""

          // Make deployment script executable and run it
          sh """
            chmod +x ${DEPLOY_DIR}/deploy.sh
            export DEPLOY_DIR=${DEPLOY_DIR}
            export APP_NAME=${APP_NAME}
            ${DEPLOY_DIR}/deploy.sh
          """
        }
      }
    }
  }

  post {
    failure {
      echo 'Deployment failed.'
    }
    success {
      echo 'Deployment succeeded.'
    }
  }
}


