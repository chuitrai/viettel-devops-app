pipeline {
    agent {
        kubernetes {
            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
  - name: golang
    image: golang:1.21-alpine
    command:
    - cat
    tty: true
    resources:
      requests:
        memory: "128Mi"
        cpu: "100m"
      limits:
        memory: "512Mi"
        cpu: "500m"

  - name: docker
    image: docker:dind
    command:
    - cat
    tty: true
    securityContext:
      privileged: true
    env:
    - name: DOCKER_TLS_CERTDIR
      value: ""
    - name: DOCKER_HOST
      value: unix:///var/run/docker.sock
    volumeMounts:
    - name: docker-storage
      mountPath: /var/lib/docker
    - name: docker-sock
      mountPath: /var/run/docker.sock
    resources:
      requests:
        memory: "256Mi"
        cpu: "100m"
      limits:
        memory: "1024Mi"
        cpu: "1000m"

  volumes:
  - name: docker-storage
    emptyDir: {}
  - name: docker-sock
    hostPath:
      path: /var/run/docker.sock
'''
        }
    }

    environment {
        DOCKERHUB_CREDENTIALS = 'dockerhub-creds'
        DOCKER_IMAGE = 'chuitrai2901/vdt-go-app'
        APP_NAME = 'vdt-go-app'
    }

    stages {

        stage('Checkout Code') {
            steps {
                git branch: 'main', url: 'https://github.com/chuitrai/viettel-devops-app.git'
            }
        }

        stage('Test & Lint Go Code') {
            steps {
                container('golang') {
                    dir('go-app') {

                        sh 'go env -w GOPROXY=https://goproxy.io,direct'
                        sh 'go mod download'

                        sh '''
                        if [ -n "$(go fmt ./...)" ]; then
                          echo "Code is not formatted"
                          exit 1
                        fi
                        '''

                        sh 'go vet ./...'
                    }
                }
            }
        }

        stage('Build & Push Docker Image') {
            steps {
                container('docker') {
                    script {

                        sh '''
                        dockerd-entrypoint.sh &
                        sleep 15
                        docker info
                        '''

                        dir('go-app') {

                            def imageTag = "${env.BUILD_NUMBER}"
                            def fullImageName = "${env.DOCKER_IMAGE}:${imageTag}"
                            def latestImageName = "${env.DOCKER_IMAGE}:latest"

                            withCredentials([usernamePassword(
                                credentialsId: env.DOCKERHUB_CREDENTIALS,
                                passwordVariable: 'DOCKERHUB_PASS',
                                usernameVariable: 'DOCKERHUB_USER'
                            )]) {

                                sh '''
                                echo $DOCKERHUB_PASS | docker login -u $DOCKERHUB_USER --password-stdin
                                '''

                                sh """
                                docker build --pull -t ${fullImageName} -t ${latestImageName} .
                                docker push ${fullImageName}
                                docker push ${latestImageName}
                                """

                                sh """
                                docker rmi ${fullImageName} ${latestImageName} || true
                                """
                            }
                        }
                    }
                }
            }
        }

        stage('Update Helm Chart') {
            steps {
                container('golang') {
                    script {

                        def imageTag = "${env.BUILD_NUMBER}"

                        dir('go-app/helm-chart') {

                            sh """
                            sed -i "s/tag:.*/tag: \\"${imageTag}\\"/" values.yaml
                            """
                        }

                        withCredentials([usernamePassword(
                            credentialsId: 'github-creds',
                            passwordVariable: 'GIT_PASSWORD',
                            usernameVariable: 'GIT_USERNAME'
                        )]) {

                            sh '''
                            git config --global user.email "jenkins@viettel.com"
                            git config --global user.name "Jenkins CI"

                            git add go-app/helm-chart/values.yaml
                            git commit -m "Jenkins Update Helm Image Tag to version ${BUILD_NUMBER} [skip ci]" || echo "No changes"

                            git pull origin main --rebase
                            git push https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/chuitrai/viettel-devops-app.git HEAD:main
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo "Pipeline completed successfully"
        }
        failure {
            echo "Pipeline failed"
        }
    }
}