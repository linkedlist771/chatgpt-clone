docker build -t myapp . ; if ($?) { docker run -p 1338:1338 myapp }