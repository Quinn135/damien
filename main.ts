//// Variables for time, delta time, and fps ////
let lastTime = input.runningTimeMicros() / 1000000;
let time = lastTime + 1 / 60;
let deltaTime = 0;

//// Calibration variables ////
let isCalibrating = false;
const calibrationSamples = 50;
let calibrationCountdown = 3;
let calibrationSamplesDone = 0;

// Used as temporary variables to add for each sample, which are then divided by the number of samples to get the average
let calibAvgForwardVector = 0;
let calibAvgUpVector = 0;
let calibAvgXVector = 0;

// Segment
let segment = 0; // 0 = calibration, 1 = button drive
const CALIBRATING = 0;
const RUNNING = 1;

// Motors speed
let lSpeed = 0; // Left motor speed (between -1 and 1)
let rSpeed = 0; // Right motor speed (between -1 and 1)

// Sonar
let sonarDist = 0;

//// Accelerometer ////
let forwardVector = 0;
let upVector = 0;
let xVector = 0;

// This updates every frame - it's the average of the last 4
let avgForwardVector = 0;
let avgUpVector = 0;
let avgXVector = 0;

// These are used to keep it calibrated
let forwardVectorOffset = 0;
let upVectorOffset = 0;
let xVectorOffset = 0;

// This stores the last 4 of each vector
let vectorsList = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];

// Not doing position right now
// // Position
// let x = 0;
// let y = 0;
// let xVel = 0;
// let yVel = 0;
// let rotation = 0; // in radians, 0deg = positive x (cos(a)*m = x, sin(a)*m = y)

while (true){
    // Update time, delta time, and frame number
    time = input.runningTimeMicros() / 1000000; // This is the current time in seconds
    deltaTime = time - lastTime; // This is the frame time

    // Update sonar and acceleration measurements
    calculateAcceleration(); // Function that updates acceleration and the vectors
    sonarDist = sonar.checkSonar(); // Get output, max of 150
    sonarDist = sonarDist == 0 ? 150 : sonarDist; // This makes it = 150 if sonarDist = 0

    // Handle each segment
    if (segment == CALIBRATING){ // Calibration/wait for calibration
        if (!isCalibrating && input.buttonIsPressed(Button.A)) { // If not calibrating, and A is pressed
            isCalibrating = true; // Start calibrating
        } 
        
        if (isCalibrating){
            if (calibrationCountdown > 0){ // If the countdown hasn't reached zero
                calibrationCountdown -= deltaTime; // Increment calibration countdown
                led.plot(3 - Math.round(calibrationCountdown + 0.5) + 2, 0); // Show countdown as 3 dots
            }
            else { // Countdown complete, and calibration is happening
                // Show blinking dot for calibrating
                if (Math.round(time / 0.5) % 2) { // Fancy math to blink every 0.5 seconds
                    led.plot(1, 0);
                } else {
                    led.unplot(1, 0);
                }

                // Add a sample to the average
                calibAvgForwardVector += forwardVector;
                calibAvgUpVector += upVector;
                calibAvgXVector += xVector;

                // Keep track of how many calibration samples added
                calibrationSamplesDone++;

                // If we have done the number of samples we need, than divide to get the average
                if (calibrationSamplesDone >= calibrationSamples) {
                    calibAvgForwardVector /= calibrationSamplesDone;
                    calibAvgUpVector /= calibrationSamplesDone;
                    calibAvgXVector /= calibrationSamplesDone;

                    // The average is the offset we need to correct for
                    forwardVectorOffset = -calibAvgForwardVector;
                    upVectorOffset = -calibAvgUpVector;
                    xVectorOffset = -calibAvgXVector;

                    segment++; // Goes to the next part of execution ("Running")
                    led.plot(1, 0); // Light to show that calibration's done
                }
            }
        }
        else { // Not calibrating
            led.plot(0, 0); // Just turn on the led
        }
    } else if (segment == RUNNING){
        if (sonarDist < 50){
            // Turn left
            // lSpeed = -0.3;
            // rSpeed = 0.3;

            // Show led turning left
            led.plot(4, 2);
            led.unplot(2, 2);
        } else {
            // Go forward
            // lSpeed = 0.3;
            // rSpeed = 0.3;

            // Show led center
            led.plot(2, 2);
            led.unplot(4, 2);
        }
    }

    // Print to serial
    serial.writeLine(Math.roundWithPrecision(1/deltaTime, 2).toString() + "fps, " + sonarDist.toString());

    driveMotors(); // Takes lSpeed and rSpeed and makes the motors turn

    // Update for delta time calcualtions
    lastTime = time;
}


// This takes the raw acceleration and turns it into vectors (up, forward, and x (which is right/left))
function calculateAcceleration(){
    let xA = input.acceleration(Dimension.X);
    let yA = input.acceleration(Dimension.Y);
    let zA = input.acceleration(Dimension.Z);

    // Fancy maths
    upVector = Math.sin(135 / 180 * Math.PI) * (-yA + zA) + 1024 + upVectorOffset; // Get the vertical velocity (accounting for gravity 1024)
    forwardVector = Math.sin(135 / 180 * Math.PI) * (-yA + -zA) + forwardVectorOffset; // Positive = acceleration forward
    xVector = xA + xVectorOffset; // Side to side acceleration

    // Shift the list of vectors so that you can update the first one
    for (let i = 3; i > 0; i -= 1){
        vectorsList[0][i] = vectorsList[0][i - 1]
        vectorsList[1][i] = vectorsList[1][i - 1]
        vectorsList[2][i] = vectorsList[2][i - 1]
    }

    vectorsList[0][0] = forwardVector;
    vectorsList[1][0] = upVector;
    vectorsList[2][0] = xA;

    // Find the average of each of the last 4 vectors
    avgForwardVector = 0;
    avgUpVector = 0;
    avgXVector = 0;

    for (let i = 0; i < 4; i++){
        avgForwardVector += vectorsList[0][i];
        avgUpVector += vectorsList[1][i];
        avgXVector += vectorsList[2][i];
    }
    avgForwardVector /= 4;
    avgUpVector /= 4;
    avgXVector /= 4;
}

// Calculate the input for the drive function, and drive
function driveMotors(){
    if (lSpeed < 0) {
        lSpeed = -1 - lSpeed;
    } if (rSpeed < 0) {
        rSpeed = -1 - rSpeed;
    }

    motion.drive(lSpeed * 100, rSpeed * 100);
}