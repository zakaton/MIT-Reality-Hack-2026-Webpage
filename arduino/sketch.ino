#include <Arduino_RouterBridge.h>
#include <Servo.h>
#include <AccelStepper.h>

const uint8_t numberOfServos = 2;
Servo servos[numberOfServos];
const uint8_t servoPins[numberOfServos] = {2, 3};
bool shouldUpdateServos[numberOfServos] = {false};
int servoAngles[numberOfServos] = {0};

#define STEP_PIN 5
#define DIR_PIN 6
#define STEPS_PER_REV 200

AccelStepper stepper(AccelStepper::DRIVER, STEP_PIN, DIR_PIN);
int stepperAngle = 0;

long stepperAngleToSteps(float degrees)
{
    return (degrees / 360.0) * STEPS_PER_REV;
}
void moveStepperToAngle(float degrees)
{
    long steps = stepperAngleToSteps(degrees);
    // Monitor.print("moveStepperToAngle ");
    // Monitor.print(degrees);
    // Monitor.print(" => ");
    // Monitor.println(steps);
    stepper.moveTo(steps);
}

bool shouldUpdateStepper = false;
bool isUpdatingStepper = false;
int servoAngle = 0;

void test()
{
    Monitor.println("test");
}

bool verifyServoIndex(int servoIndex)
{
    if (servoIndex >= numberOfServos)
    {
        Monitor.print("invalid servoIndex - max ");
        Monitor.println(numberOfServos - 1);
        return false;
    }
    return true;
}
void setServoAngle(int servoIndex, int angle)
{
    // Monitor.print("setServoAngle #");
    // Monitor.print(servoIndex);
    // Monitor.print(" at angle ");
    // Monitor.println(angle);

    if (!verifyServoIndex(servoIndex))
    {
        return;
    }

    shouldUpdateServos[servoIndex] = true;
    servoAngles[servoIndex] = angle;
    // Monitor.println("updated shouldUpdateServos");
}

void setStepperAngle(int angle)
{
    // Monitor.print("setStepperAngle at angle ");
    // Monitor.println(angle);

    shouldUpdateStepper = true;
    stepperAngle = angle;
}

void setup()
{
    stepper.setMaxSpeed(2000);
    stepper.setAcceleration(1000);

    for (uint8_t i = 0; i < numberOfServos; i++)
    {
        servos[i].attach(servoPins[i]);
    }

    Bridge.begin();
    Bridge.provide("test", test);
    Bridge.provide("setServoAngle", setServoAngle);
    Bridge.provide("setStepperAngle", setStepperAngle);
    Monitor.println("setup");
}

int servoTest = 0;
void loop()
{
    if (false)
    {
        Monitor.println("moving servo");
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
            // Monitor.println(i);
            servos[i].write(servoAngles[i]);
            shouldUpdateServos[i] = false;
        }
    }

    if (shouldUpdateStepper)
    {
        // Monitor.print("shouldUpdateStepper ");
        // Monitor.println(stepperAngle);
        moveStepperToAngle(stepperAngle);
        isUpdatingStepper = true;
        shouldUpdateStepper = false;
    }
    if (isUpdatingStepper)
    {
        isUpdatingStepper = stepper.run();
    }
}
