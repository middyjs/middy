<script>
    import './+layout.css'
const { children } = $props();
</script>

{@render children?.()}

<style>
    /* Using external css files. :global(.class, .class) not supported */
</style>
