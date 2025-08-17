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
    ansiColor('xterm')
  }

  stages {
    stage('Checkout') {
      steps {
        checkout([
          $class: 'GitSCM',
          branches: [[name: '*/main']],
          doGenerateSubmoduleConfigurations: false,
          extensions: [
            [$class: 'CloneOption', shallow: true, depth: 2, noTags: false, reference: '']
          ],
          submoduleCfg: [],
          userRemoteConfigs: [[
            url: env.GIT_URL ?: 'git@github.com:your-org/ever-life-vault.git',
            credentialsId: env.GIT_CREDENTIALS_ID ?: 'github-ssh'
          ]]
        ])
      }
    }

    stage('Build images') {
      steps {
        script {
          dir('deploy') {
            // Clean up old images to save space
            sh 'docker image prune -f --filter "dangling=true"'
            
            // Build images with error handling
            sh '''
              set -e
              echo "Building backend image..."
              docker build -t ${APP_NAME}/backend:latest -f ../server/Dockerfile ../server
              
              echo "Building web image..."
              docker build -t ${APP_NAME}/web:latest -f ../Dockerfile ..
              
              echo "Images built successfully"
              docker images | grep ${APP_NAME}
            '''
          }
        }
      }
    }

    stage('Deploy') {
      steps {
        script {
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

          // Write .env from Jenkins credentials/params if provided (expand shell env)
          sh """cat > ${DEPLOY_DIR}/.env << 'EOF'
WEB_PORT=${WEB_PORT}
PUBLIC_BASE_URL=${PUBLIC_BASE_URL}
ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_ANON_KEY=${SUPABASE_ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SUPABASE_SERVICE_ROLE_KEY}
REDDIT_CLIENT_ID=${REDDIT_CLIENT_ID}
REDDIT_CLIENT_SECRET=${REDDIT_CLIENT_SECRET}
REDDIT_REDIRECT_URI=${REDDIT_REDIRECT_URI}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET}
GOOGLE_REDIRECT_URI=${GOOGLE_REDIRECT_URI}
MS_CLIENT_ID=${MS_CLIENT_ID}
MS_CLIENT_SECRET=${MS_CLIENT_SECRET}
MS_REDIRECT_URI=${MS_REDIRECT_URI}
YT_CLIENT_ID=${YT_CLIENT_ID}
YT_CLIENT_SECRET=${YT_CLIENT_SECRET}
YT_REDIRECT_URI=${YT_REDIRECT_URI}
YTM_CLIENT_ID=${YTM_CLIENT_ID}
YTM_CLIENT_SECRET=${YTM_CLIENT_SECRET}
YTM_REDIRECT_URI=${YTM_REDIRECT_URI}
SPOTIFY_CLIENT_ID=${SPOTIFY_CLIENT_ID}
SPOTIFY_CLIENT_SECRET=${SPOTIFY_CLIENT_SECRET}
SPOTIFY_REDIRECT_URI=${SPOTIFY_REDIRECT_URI}
STEAM_WEB_API_KEY=${STEAM_WEB_API_KEY}
MAL_CLIENT_ID=${MAL_CLIENT_ID}
MAL_CLIENT_SECRET=${MAL_CLIENT_SECRET}
MAL_REDIRECT_URI=${MAL_REDIRECT_URI}
MAL_TOKENS_SECRET=${MAL_TOKENS_SECRET}
EOF"""

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


