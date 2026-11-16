# fp16 weights, fp32 maths: ONNX Runtime's WebGPU backend runs fp16 MatMul and
# Softmax with fp16 sums, which drifts too far over TripoSplat's 1024-wide
# layers (the CPU backend, same graph, is about 100x closer to PyTorch). This
# rewrites a graph from export.py so each fp16 MatMul, Gemm and Softmax reads
# fp32 copies of its inputs and casts its answer back to fp16. The file keeps
# fp16 weights (same download); the runtime holds fp32 copies of the casts.
#   python fp32math.py onnx/gs.onnx onnx/gs32.onnx
import sys

import onnx
from onnx import TensorProto, helper, shape_inference

OPS = {"MatMul", "Gemm", "Softmax"}
src, dst = sys.argv[1], sys.argv[2]
m = onnx.load(src)
inferred = shape_inference.infer_shapes(m)
types = {v.name: v.type.tensor_type.elem_type for v in list(inferred.graph.value_info) + list(inferred.graph.input) + list(inferred.graph.output)}
types.update({i.name: i.data_type for i in m.graph.initializer})

nodes, n = [], 0
for node in m.graph.node:
    if node.op_type not in OPS or types.get(node.output[0]) != TensorProto.FLOAT16:
        nodes.append(node)
        continue
    n += 1
    for k, name in enumerate(node.input):
        if name and types.get(name) == TensorProto.FLOAT16:
            cast = f"{name}__f32_{n}_{k}"
            nodes.append(helper.make_node("Cast", [name], [cast], to=TensorProto.FLOAT))
            node.input[k] = cast
    out = node.output[0]
    node.output[0] = f"{out}__f32"
    nodes.append(node)
    nodes.append(helper.make_node("Cast", [node.output[0]], [out], to=TensorProto.FLOAT16))
del m.graph.node[:]
m.graph.node.extend(nodes)
onnx.save(m, dst)
print(dst, n, "ops now in fp32")
