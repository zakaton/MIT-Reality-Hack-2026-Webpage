from arduino.app_utils import *
from arduino.app_bricks.web_ui import WebUI

ui = WebUI()
ui.expose_api("GET", "/", lambda: "powerpet")


def on_test(client, data):
    print("on_test")
    print(data)
    Bridge.call("test")


angles = {"servos": [0, 0], "steppers": [0]}


def on_get_angles(client, data):
    # print("on_get_angles")
    # print(data)
    ui.send_message("getAngles", angles, client)


def set_at_index(lst, index, value, fill=0):
    if index >= len(lst):
        lst.extend([fill] * (index + 1 - len(lst)))
    lst[index] = value


def set_servo_angle(client, data, notify=True):
    # print("on_set_servo_angle")
    # print(data)

    Bridge.call("setServoAngle", data["index"], data["angle"])
    set_at_index(angles["servos"], data["index"], data["angle"])
    if notify:
        ui.send_message("getAngles", angles)


def set_stepper_angle(client, data, notify=True):
    # print("on_set_stepper_angle")
    # print(data)

    Bridge.call("setStepperAngle", data["angle"])
    set_at_index(angles["steppers"], 0, data["angle"])
    if notify:
        ui.send_message("getAngles", angles)


def on_set_angle(client, data, notify=True):
    # print("on_set_angle")
    # print(data)

    match data["type"]:
        case "servos":
            set_servo_angle(client, data, False)
        case "steppers":
            set_stepper_angle(client, data, False)
        case _:
            print("invalid angle type")
            print(data["type"])

    if notify:
        ui.send_message("getAngles", angles)


def on_set_angles(client, data, notify=True):
    # print("on_set_angles")
    # print(data)

    for index, angle in enumerate(data.get("servos", [])):
        # print(f"servo index #{index}, angle {angle}")
        set_servo_angle(client, {"index": index, "angle": angle}, False)

    for index, angle in enumerate(data.get("steppers", [])):
        # print(f"stepper index #{index}, angle {angle}")
        set_stepper_angle(client, {"angle": angle}, False)

    if notify:
        ui.send_message("getAngles", angles)


def on_broadcast(client, data, notify=True):
    # print("on_broadcast")
    # print(data)

    if notify:
        ui.send_message("broadcast", data)


state = {}


def on_get_state(client, data):
    # print("on_get_state")
    # print(data)
    ui.send_message("state", state, client)


def on_set_state(client, data, notify=True):
    print("on_set_state")
    print(data)

    diff = {}

    for key, new_val in data.items():
        old_val = state.get(key)
        if old_val != new_val:
            diff[key] = new_val
            state[key] = new_val

    if notify:
        ui.send_message("stateDiff", diff)


# Handle socket messages (like in Code Scanner example)
ui.on_message("test", on_test)
ui.on_message("getAngles", on_get_angles)
ui.on_message("setAngle", on_set_angle)
ui.on_message("setAngles", on_set_angles)
ui.on_message("broadcast", on_broadcast)
ui.on_message("getState", on_get_state)
ui.on_message("setState", on_set_state)

# Start the application
App.run()
