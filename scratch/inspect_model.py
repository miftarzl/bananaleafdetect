import os
try:
    import tensorflow as tf
    print("TensorFlow version:", tf.__version__)
    interpreter = tf.lite.Interpreter(model_path="model/best.tflite")
    interpreter.allocate_tensors()
    input_details = interpreter.get_input_details()
    output_details = interpreter.get_output_details()
    print("Input details:")
    print(input_details)
    print("\nOutput details:")
    print(output_details)
except Exception as e:
    print("Error:", e)
