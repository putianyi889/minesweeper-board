# Rendering outputs

This example renders four independent layers and composites them in caller-chosen
order. It also checks real texture pixels and transparency. No visible board
component is required to generate the output.

<script setup>
import RenderingExample from './components/RenderingExample.vue'
</script>

<ClientOnly>
  <RenderingExample />
</ClientOnly>

See [Canvas and bitmap rendering](./api/rendering) for input settings, completion,
ownership and errors.
