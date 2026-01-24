#include <Arduino_RouterBridge.h>
#include <Servo.h>
#include <AccelStepper.h>

const uint8_t numberOfServos = 2;
Servo servos[numberOfServos];
const uint8_t servoPins[numberOfServos] = {2, 4};
bool shouldUpdateServos[numberOfServos] = {false};
int servoAngles[numberOfServos] = {0};

#define STEP_PIN 3
#define DIR_PIN 2
#define STEPS_PER_REV 100

AccelStepper stepper(AccelStepper::DRIVER, STEP_PIN, DIR_PIN);
int stepperAngle = 0;

long stepperAngleToSteps(float degrees)
{
    return (degrees / 360.0) * STEPS_PER_REV;
}
void moveStepperToAngle(float degrees)
{
    stepper.moveTo(stepperAngleToSteps(degrees));
}

bool shouldUpdateStepper = false;
int servoAngle = 0;

void setup()
{
    stepper.setMaxSpeed(2000);
    stepper.setAcceleration(500);

    for (uint8_t i = 0; i < numberOfServos; i++)
    {
        servos[i].attach(servoPins[i]);
    }

    Bridge.begin();
    Bridge.provide("set_servo_angle", set_servo_angle);
    Bridge.provide("set_stepper_angle", set_stepper_angle);
}

int servoTest = 0;
void loop()
{
    if (false)
    {
        for (uint8_t i = 0; i < numberOfServos; i++)
        {
            servos[i].write(servoTest % 90);
        }
        servoTest++;
        delay(30);
    }

    for (uint8_t i = 0; i < numberOfServos; i++)
    {
        if (shouldUpdateServos[i])
        {
            // Monitor.print("shouldUpdateServo #");
            // Monitor.print(i);
            // Monitor.println();
            servos[i].write(servoAngles[i]);
            shouldUpdateServos[i] = false;
        }
    }

    if (shouldUpdateStepper)
    {
        // Monitor.println("shouldUpdateStepper");
        moveStepperToAngle(stepperAngle);
        shouldUpdateStepper = false;
    }
}

bool verify_servo_index(int servoIndex)
{
    if (servoIndex >= numberOfServos)
    {
        Monitor.print("invalid servoIndex - max ");
        Monitor.print(numberOfServos - 1);
        Monitor.println();
        return false;
    }
    return true;
}
void set_servo_angle(int servoIndex, int angle)
{
    // Monitor.print("set_servo_angle #");
    // Monitor.print(servoIndex);
    // Monitor.print(" at angle ");
    // Monitor.print(angle);
    // Monitor.println();

    if (!verify_servo_index(servoIndex))
    {
        return;
    }

    shouldUpdateServos[servoIndex] = true;
    servoAngles[servoIndex] = angle;
}

void set_stepper_angle(int angle)
{
    // Monitor.print("set_stepper_angle at angle ");
    // Monitor.print(angle);
    // Monitor.println();

    shouldUpdateStepper = true;
    stepperAngle = angle;
}