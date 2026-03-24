import { mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import CostBarChart from '../../src/components/cost/CostBarChart.vue';

describe('CostBarChart', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('renders one row per data item', () => {
    const items = [
      { label: 'claude-3-opus', tokens: 12345 },
      { label: 'claude-3-haiku', tokens: 5678 },
      { label: 'claude-3-sonnet', tokens: 9012 },
    ];

    const wrapper = mount(CostBarChart, { props: { items } });

    // Each item lives inside a flex row container
    const rows = wrapper.findAll('.flex.items-center.gap-3');
    expect(rows).toHaveLength(items.length);
  });

  it('renders each item label as text', () => {
    const items = [
      { label: 'Agent A', tokens: 20000 },
      { label: 'Agent B', tokens: 10000 },
    ];

    const wrapper = mount(CostBarChart, { props: { items } });

    expect(wrapper.text()).toContain('Agent A');
    expect(wrapper.text()).toContain('Agent B');
  });

  it('displays formatted token values for each bar', () => {
    const items = [
      { label: 'Model X', tokens: 1234 },
      { label: 'Model Y', tokens: 156780 },
    ];

    const wrapper = mount(CostBarChart, { props: { items } });

    expect(wrapper.text()).toContain('1.2K');
    expect(wrapper.text()).toContain('157K');
  });

  it('gives the highest-value bar 100% width and scales others proportionally', () => {
    const items = [
      { label: 'High', tokens: 10000 },
      { label: 'Half', tokens: 5000 },
    ];

    const wrapper = mount(CostBarChart, { props: { items } });

    // The inner coloured divs carry the inline width style
    const bars = wrapper.findAll('[style*="width"]');
    expect(bars[0].attributes('style')).toContain('100%');
    expect(bars[1].attributes('style')).toContain('50%');
  });

  it('shows the empty state message when items array is empty', () => {
    const wrapper = mount(CostBarChart, { props: { items: [] } });

    expect(wrapper.text()).toContain('尚無數據');
    // No bar rows should be present
    expect(wrapper.findAll('.flex.items-center.gap-3')).toHaveLength(0);
  });
});
